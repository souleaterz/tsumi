package com.tsumi.tv

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.github.se_bastiaan.torrentstream.StreamStatus
import com.github.se_bastiaan.torrentstream.Torrent
import com.github.se_bastiaan.torrentstream.TorrentOptions
import com.github.se_bastiaan.torrentstream.TorrentStream
import com.github.se_bastiaan.torrentstream.listeners.TorrentListener

/**
 * Native BitTorrent streaming — the keyless (no Real-Debrid) path, the same idea
 * as the desktop app's electron/torrent.js. TorrentStream connects to real TCP/
 * uTP peers (a browser can't), downloads sequentially, and hands us the video
 * file to play as it fills. This is why the Fire TV app can stream public anime
 * torrents that the website cannot.
 */
class TorrentStreamer(context: Context) {

    private val stream: TorrentStream
    // The listener for the in-flight stream, so we can detach it on stop. Without
    // this, every start() adds another listener to the singleton TorrentStream and
    // stale ones from earlier attempts keep firing.
    private var activeListener: TorrentListener? = null

    init {
        val options = TorrentOptions.Builder()
            .saveLocation(context.cacheDir.absolutePath + "/tsumi-torrents")
            .removeFilesAfterStop(true)
            .autoDownload(true)
            .build()
        stream = TorrentStream.init(options)
    }

    /**
     * Start streaming a magnet/infoHash. `onReady` fires with a local file path
     * once enough is buffered to begin playback; `onError` fires on failure.
     *
     * [timeoutMs] guards only PEER DISCOVERY — if no peers/metadata appear in that
     * window we give up so the UI can try the next source. Once peers are found
     * the guard is cancelled: a healthy-but-slow torrent is then allowed to keep
     * buffering instead of being killed with a misleading "no peers" error.
     */
    fun start(
        magnet: String,
        timeoutMs: Long,
        onReady: (path: String) -> Unit,
        onError: (message: String) -> Unit,
    ) {
        stopQuietly()

        var settled = false
        var peersFound = false
        val timeout = Handler(Looper.getMainLooper())
        val timeoutRunnable = Runnable {
            if (!settled) {
                settled = true
                stopQuietly()
                onError("No peers found for this source (timed out).")
            }
        }

        // Peers are alive — stop the discovery timeout and let it buffer freely.
        val markPeersFound = {
            if (!peersFound) {
                peersFound = true
                timeout.removeCallbacks(timeoutRunnable)
            }
        }

        val listener = object : TorrentListener {
            override fun onStreamPrepared(torrent: Torrent) {
                // Reaching "prepared" means metadata was fetched from peers.
                markPeersFound()
                torrent.startDownload()
            }

            override fun onStreamStarted(torrent: Torrent) {
                markPeersFound()
            }

            override fun onStreamReady(torrent: Torrent) {
                if (settled) return
                settled = true
                timeout.removeCallbacks(timeoutRunnable)
                onReady(torrent.videoFile.absolutePath)
            }

            override fun onStreamProgress(torrent: Torrent, status: StreamStatus) {
                if (status.seeds > 0 || status.bufferProgress > 0) markPeersFound()
            }

            override fun onStreamStopped() {}

            override fun onStreamError(torrent: Torrent?, e: Exception) {
                if (settled) return
                settled = true
                timeout.removeCallbacks(timeoutRunnable)
                onError(e.message ?: "Could not start this torrent.")
            }
        }
        activeListener = listener
        stream.addListener(listener)

        timeout.postDelayed(timeoutRunnable, timeoutMs)
        stream.startStream(magnet)
    }

    fun stop() = stopQuietly()

    private fun stopQuietly() {
        activeListener?.let {
            try {
                stream.removeListener(it)
            } catch (_: Exception) {
            }
        }
        activeListener = null
        try {
            if (stream.isStreaming) stream.stopStream()
        } catch (_: Exception) {
        }
    }
}
