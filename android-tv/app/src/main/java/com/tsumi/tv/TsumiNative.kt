package com.tsumi.tv

import android.app.Activity
import android.content.Intent
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

/**
 * The raw JS ↔ native interface, exposed to the web app as window.TsumiNative.
 * Every method is fire-and-forget with a request id; results are delivered back
 * asynchronously via window.__tsumiResolve(id, json) (see lib/tv-native.ts,
 * which promisifies all of this). Keep the method names in sync with that file.
 */
class TsumiNative(
    private val activity: Activity,
    private val web: WebView,
    private val streamer: TorrentStreamer,
) {

    private fun resolve(reqId: Int, json: String) {
        activity.runOnUiThread {
            web.evaluateJavascript("window.__tsumiResolve && window.__tsumiResolve($reqId, ${JSONObject.quote(json)})", null)
        }
    }

    @JavascriptInterface
    fun version(): String = BuildConfig.VERSION_NAME

    /** Torrent a magnet/infoHash → resolve { ok, url } with a local file URL. */
    @JavascriptInterface
    fun streamTorrent(reqId: Int, magnet: String) {
        streamer.start(
            magnet = magnet,
            timeoutMs = 30_000,
            onReady = { path ->
                resolve(reqId, JSONObject().put("ok", true).put("url", "file://$path").toString())
            },
            onError = { message ->
                resolve(reqId, JSONObject().put("ok", false).put("error", message).toString())
            },
        )
    }

    /** Launch the native player on a direct media URL (RD link or torrent file). */
    @JavascriptInterface
    fun play(reqId: Int, optsJson: String) {
        try {
            val root = JSONObject(optsJson)
            val url = root.getString("url")
            val opts = root.optJSONObject("opts") ?: JSONObject()
            val intent = Intent(activity, PlayerActivity::class.java).apply {
                putExtra("url", url)
                putExtra("title", opts.optString("title", ""))
                putExtra("startAt", opts.optDouble("startAt", 0.0))
                putExtra("hasNext", opts.optBoolean("hasNext", false))
                putExtra("subs", (opts.optJSONArray("subtitles") ?: org.json.JSONArray()).toString())
            }
            activity.startActivity(intent)
            resolve(reqId, JSONObject().put("ok", true).toString())
        } catch (e: Exception) {
            resolve(reqId, JSONObject().put("ok", false).put("error", e.message ?: "Bad play request").toString())
        }
    }

    /** Stop playback + any active torrent. */
    @JavascriptInterface
    fun stop(reqId: Int) {
        PlaybackBus.stopper?.invoke()
        streamer.stop()
        resolve(reqId, JSONObject().put("ok", true).toString())
    }
}
