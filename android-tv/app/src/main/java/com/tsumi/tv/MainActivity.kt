package com.tsumi.tv

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

/**
 * The whole Tsumi TV app is this one WebView loading the hosted 10-foot site,
 * PLUS a native bridge that adds what a browser can't do on a Firestick:
 * keyless torrent streaming and smooth native playback (libVLC). This mirrors
 * the desktop Electron shell (electron/main.js) one-to-one.
 *
 * The web app talks to us through window.TsumiNative (injected below); our
 * lib/tv-native.ts wraps that raw interface into the Promise-based bridge the UI
 * calls. Because addJavascriptInterface objects exist before page scripts run,
 * there's no load-order race.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var streamer: TorrentStreamer
    private var exitDialog: AlertDialog? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        goImmersive()

        streamer = TorrentStreamer(this)

        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            // Some AniList/CDN images + the YouTube trailer need a modern UA.
            userAgentString = "$userAgentString TsumiTV/${BuildConfig.APP_URL}"
        }
        // Keep all navigation inside the WebView; open nothing in a browser.
        web.webViewClient = WebViewClient()
        web.webChromeClient = WebChromeClient()

        web.addJavascriptInterface(TsumiNative(this, web, streamer), "TsumiNative")

        // Forward player events into the web app.
        PlaybackBus.sink = { event, payload ->
            runOnUiThread {
                when (event) {
                    "progress" ->
                        web.evaluateJavascript("window.__tsumiEmitProgress && window.__tsumiEmitProgress(${JSONObject.quote(payload)})", null)
                    "next" ->
                        web.evaluateJavascript("window.__tsumiEmitNext && window.__tsumiEmitNext()", null)
                }
            }
        }

        web.loadUrl(BuildConfig.APP_URL)
    }

    // Remote BACK: walk back through web history; at the home root, confirm exit
    // instead of silently dropping to the launcher.
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (exitDialog?.isShowing == true) return true // let the dialog handle it
            if (web.canGoBack()) {
                web.goBack()
            } else {
                confirmExit()
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun confirmExit() {
        if (exitDialog?.isShowing == true) return
        exitDialog = AlertDialog.Builder(this)
            .setTitle("Exit Tsumi?")
            .setMessage("Leave the app and return to the Fire TV home screen?")
            .setPositiveButton("Exit") { _, _ -> finish() }
            .setNegativeButton("Stay", null)
            .create()
            .also { dialog ->
                dialog.show()
                // Default focus to "Stay" so an accidental extra BACK/OK doesn't quit.
                dialog.getButton(AlertDialog.BUTTON_NEGATIVE)?.requestFocus()
            }
    }

    private fun goImmersive() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
    }

    override fun onDestroy() {
        exitDialog?.dismiss()
        exitDialog = null
        PlaybackBus.sink = null
        streamer.stop()
        web.destroy()
        super.onDestroy()
    }
}
