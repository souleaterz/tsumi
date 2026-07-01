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
     * once enough is buffered to begin playback; `onError` fires on failure or
     * if no peers appear within [timeoutMs] (so the UI can try the next source).
     */
    fun start(
        magnet: String,
        timeoutMs: Long,
        onReady: (path: String) -> Unit,
        onError: (message: String) -> Unit,
    ) {
        stopQuietly()

        var settled = false
        val timeout = Handler(Looper.getMainLooper())
        val timeoutRunnable = Runnable {
            if (!settled) {
                settled = true
                stopQuietly()
                onError("No peers found for this source (timed out).")
            }
        }

        stream.addListener(object : TorrentListener {
            override fun onStreamPrepared(torrent: Torrent) {
                torrent.startDownload()
            }

            override fun onStreamStarted(torrent: Torrent) {}

            override fun onStreamReady(torrent: Torrent) {
                if (settled) return
                settled = true
                timeout.removeCallbacks(timeoutRunnable)
                onReady(torrent.videoFile.absolutePath)
            }

            override fun onStreamProgress(torrent: Torrent, status: StreamStatus) {}

            override fun onStreamStopped() {}

            override fun onStreamError(torrent: Torrent?, e: Exception) {
                if (settled) return
                settled = true
                timeout.removeCallbacks(timeoutRunnable)
                onError(e.message ?: "Could not start this torrent.")
            }
        })

        timeout.postDelayed(timeoutRunnable, timeoutMs)
        stream.startStream(magnet)
    }

    fun stop() = stopQuietly()

    private fun stopQuietly() {
        try {
            if (stream.isStreaming) stream.stopStream()
        } catch (_: Exception) {
        }
    }
}
