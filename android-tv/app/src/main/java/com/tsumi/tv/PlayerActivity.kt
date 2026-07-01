package com.tsumi.tv

import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import org.json.JSONObject
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.interfaces.IMedia
import org.videolan.libvlc.util.VLCVideoLayout

/**
 * Full-screen native player. libVLC plays raw mkv (dual audio + external subs)
 * as well as HLS / Real-Debrid direct links — the Stremio model that plays what
 * a browser can't. Playback position streams back to the web app for progress /
 * Continue watching; when an episode ends and a next one exists, it asks the web
 * app to advance.
 *
 * On top of the video surface it draws a Stremio-style transport bar (scrubbable
 * seek bar, play/pause, ±10s, subtitle + audio track pickers) that appears on any
 * remote key press and auto-hides after a few idle seconds.
 */
class PlayerActivity : AppCompatActivity() {

    private lateinit var libVLC: LibVLC
    private lateinit var player: MediaPlayer
    private lateinit var videoLayout: VLCVideoLayout

    private lateinit var loading: View
    private lateinit var controls: LinearLayout
    private lateinit var seek: SeekBar
    private lateinit var currentTime: TextView
    private lateinit var totalTime: TextView
    private lateinit var playPause: Button

    private var hasNext = false
    private var startAtMs = 0L
    private var resumed = false
    private var lengthMs = 0L

    private val ui = Handler(Looper.getMainLooper())
    private val hideControls = Runnable { setControlsVisible(false) }
    private val autoHideMs = 4500L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_player)

        val url = intent.getStringExtra("url") ?: run { finish(); return }
        startAtMs = (intent.getDoubleExtra("startAt", 0.0) * 1000).toLong()
        hasNext = intent.getBooleanExtra("hasNext", false)
        val subs = JSONArray(intent.getStringExtra("subs") ?: "[]")

        videoLayout = findViewById(R.id.videoLayout)
        loading = findViewById(R.id.loading)
        controls = findViewById(R.id.controls)
        seek = findViewById(R.id.seek)
        currentTime = findViewById(R.id.currentTime)
        totalTime = findViewById(R.id.totalTime)
        playPause = findViewById(R.id.playPause)
        findViewById<TextView>(R.id.loadingTitle).text =
            intent.getStringExtra("title").orEmpty().ifEmpty { "Loading…" }

        wireControls()

        val args = arrayListOf(
            "--no-drop-late-frames",
            "--no-skip-frames",
            "--network-caching=1500",
            "--audio-language=eng", // prefer the English dub track when present
        )
        libVLC = LibVLC(this, args)
        player = MediaPlayer(libVLC)
        player.attachViews(videoLayout, null, false, false)

        val media = Media(libVLC, Uri.parse(url)).apply {
            setHWDecoderEnabled(true, false)
        }
        player.media = media
        media.release()

        player.setEventListener { event ->
            when (event.type) {
                MediaPlayer.Event.Playing -> {
                    if (!resumed && startAtMs > 0) {
                        player.time = startAtMs
                        resumed = true
                    }
                    attachSubtitles(subs)
                    loading.visibility = View.GONE // first frame is up
                    playPause.text = "Pause"
                }
                MediaPlayer.Event.Paused -> playPause.text = "Play"
                MediaPlayer.Event.LengthChanged -> {
                    lengthMs = player.length
                    seek.max = lengthMs.toInt().coerceAtLeast(0)
                    totalTime.text = formatTime(lengthMs)
                }
                MediaPlayer.Event.TimeChanged -> {
                    emitProgress(false)
                    // While the user is scrubbing (seek bar focused) let them drive
                    // it; otherwise track playback.
                    if (!seek.isFocused) updateScrubber(player.time)
                }
                MediaPlayer.Event.EndReached -> onEnded()
                MediaPlayer.Event.EncounteredError -> finish()
            }
        }

        PlaybackBus.stopper = { runOnUiThread { finish() } }
        player.play()
    }

    // ── Controls ──────────────────────────────────────────────────────────

    private fun wireControls() {
        seek.keyProgressIncrement = 10_000 // 10s per D-pad step
        seek.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar: SeekBar, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    player.time = progress.toLong()
                    currentTime.text = formatTime(progress.toLong())
                    scheduleAutoHide()
                }
            }
            override fun onStartTrackingTouch(bar: SeekBar) {}
            override fun onStopTrackingTouch(bar: SeekBar) {}
        })

        playPause.setOnClickListener { togglePlay(); scheduleAutoHide() }
        findViewById<Button>(R.id.rewind).setOnClickListener { seekBy(-10_000); scheduleAutoHide() }
        findViewById<Button>(R.id.forward).setOnClickListener { seekBy(10_000); scheduleAutoHide() }
        findViewById<Button>(R.id.subs).setOnClickListener { showTrackDialog(subtitle = true) }
        findViewById<Button>(R.id.audio).setOnClickListener { showTrackDialog(subtitle = false) }
    }

    private fun setControlsVisible(visible: Boolean) {
        controls.visibility = if (visible) View.VISIBLE else View.GONE
        ui.removeCallbacks(hideControls)
        if (visible) {
            seek.requestFocus()
            scheduleAutoHide()
        }
    }

    private fun scheduleAutoHide() {
        ui.removeCallbacks(hideControls)
        ui.postDelayed(hideControls, autoHideMs)
    }

    private val controlsVisible get() = controls.visibility == View.VISIBLE

    private fun togglePlay() {
        if (player.isPlaying) player.pause() else player.play()
    }

    private fun seekBy(deltaMs: Long) {
        val target = (player.time + deltaMs).coerceIn(0, if (lengthMs > 0) lengthMs else Long.MAX_VALUE)
        player.time = target
        updateScrubber(target)
    }

    private fun updateScrubber(posMs: Long) {
        seek.progress = posMs.toInt()
        currentTime.text = formatTime(posMs)
    }

    /** Subtitle / audio track chooser, populated live from libVLC. */
    private fun showTrackDialog(subtitle: Boolean) {
        val tracks = (if (subtitle) player.spuTracks else player.audioTracks) ?: emptyArray()
        if (tracks.isEmpty()) return
        val labels = tracks.map { it.name }.toTypedArray()
        val current = if (subtitle) player.spuTrack else player.audioTrack
        val checked = tracks.indexOfFirst { it.id == current }
        AlertDialog.Builder(this)
            .setTitle(if (subtitle) "Subtitles" else "Audio")
            .setSingleChoiceItems(labels, checked) { dialog, which ->
                val id = tracks[which].id
                if (subtitle) player.spuTrack = id else player.audioTrack = id
                dialog.dismiss()
            }
            .setOnDismissListener { scheduleAutoHide() }
            .show()
    }

    private fun formatTime(ms: Long): String {
        val total = (ms / 1000).coerceAtLeast(0)
        val h = total / 3600
        val m = (total % 3600) / 60
        val s = total % 60
        return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
    }

    private fun attachSubtitles(subs: JSONArray) {
        for (i in 0 until subs.length()) {
            val s = subs.optJSONObject(i) ?: continue
            val u = s.optString("url").ifEmpty { subs.optString(i) }
            if (u.isNotEmpty()) {
                player.addSlave(IMedia.Slave.Type.Subtitle, Uri.parse(u), i == 0)
            }
        }
    }

    private fun emitProgress(ended: Boolean) {
        val dur = (if (lengthMs > 0) lengthMs else player.length) / 1000.0
        val pos = player.time / 1000.0
        PlaybackBus.emitProgress(
            JSONObject().put("position", pos).put("duration", dur).put("ended", ended).toString(),
        )
    }

    private fun onEnded() {
        emitProgress(true)
        if (hasNext) PlaybackBus.emitNext()
        finish()
    }

    // Remote transport. Handled in dispatchKeyEvent so we see every key BEFORE the
    // focused view consumes it: first press of any nav/OK key just reveals the
    // controls (Netflix-style); once up, the focus system drives them and any key
    // keeps them alive. Media keys always act. BACK hides the controls if shown,
    // otherwise falls through to the default (exit).
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val down = event.action == KeyEvent.ACTION_DOWN
        when (event.keyCode) {
            KeyEvent.KEYCODE_BACK -> {
                if (down && controlsVisible) { setControlsVisible(false); return true }
            }
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                if (down) { togglePlay(); setControlsVisible(true) }
                return true
            }
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> {
                if (down) { seekBy(10_000); setControlsVisible(true) }
                return true
            }
            KeyEvent.KEYCODE_MEDIA_REWIND -> {
                if (down) { seekBy(-10_000); setControlsVisible(true) }
                return true
            }
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER,
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN,
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT -> {
                if (down && !controlsVisible) { setControlsVisible(true); return true }
                if (down) scheduleAutoHide() // keep controls alive during navigation
            }
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onStop() {
        super.onStop()
        if (isFinishing) emitProgress(false) // persist last position on exit
    }

    override fun onDestroy() {
        ui.removeCallbacks(hideControls)
        PlaybackBus.stopper = null
        player.stop()
        player.detachViews()
        player.release()
        libVLC.release()
        super.onDestroy()
    }
}
