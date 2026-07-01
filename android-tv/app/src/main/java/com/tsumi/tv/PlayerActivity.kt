package com.tsumi.tv

import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
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
 */
class PlayerActivity : AppCompatActivity() {

    private lateinit var libVLC: LibVLC
    private lateinit var player: MediaPlayer
    private lateinit var videoLayout: VLCVideoLayout

    private var hasNext = false
    private var startAtMs = 0L
    private var resumed = false
    private var lengthMs = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        videoLayout = VLCVideoLayout(this)
        setContentView(videoLayout)

        val url = intent.getStringExtra("url") ?: run { finish(); return }
        startAtMs = (intent.getDoubleExtra("startAt", 0.0) * 1000).toLong()
        hasNext = intent.getBooleanExtra("hasNext", false)
        val subs = JSONArray(intent.getStringExtra("subs") ?: "[]")

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
                }
                MediaPlayer.Event.LengthChanged -> lengthMs = player.length
                MediaPlayer.Event.TimeChanged -> emitProgress(false)
                MediaPlayer.Event.EndReached -> onEnded()
                MediaPlayer.Event.EncounteredError -> finish()
            }
        }

        PlaybackBus.stopper = { runOnUiThread { finish() } }
        player.play()
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

    // D-pad transport: OK = play/pause, left/right = seek 10s, back = exit.
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE ->
                if (player.isPlaying) player.pause() else player.play()
            KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD ->
                player.time = player.time + 10_000
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_MEDIA_REWIND ->
                player.time = (player.time - 10_000).coerceAtLeast(0)
            KeyEvent.KEYCODE_BACK -> finish()
            else -> return super.onKeyDown(keyCode, event)
        }
        return true
    }

    override fun onStop() {
        super.onStop()
        if (isFinishing) emitProgress(false) // persist last position on exit
    }

    override fun onDestroy() {
        PlaybackBus.stopper = null
        player.stop()
        player.detachViews()
        player.release()
        libVLC.release()
        super.onDestroy()
    }
}
