package com.tsumi.tv

/**
 * Tiny in-process bus between the full-screen PlayerActivity and MainActivity's
 * WebView. The player posts progress / next-episode events up; MainActivity
 * forwards them into the web app (window.__tsumiEmitProgress / __tsumiEmitNext).
 * MainActivity can also ask the active player to stop.
 */
object PlaybackBus {
    /** Player → web. `event` is "progress" (payload = JSON) or "next" (payload = ""). */
    @Volatile
    var sink: ((event: String, payload: String) -> Unit)? = null

    /** Web/Main → player: stop the currently playing item. */
    @Volatile
    var stopper: (() -> Unit)? = null

    fun emitProgress(json: String) {
        sink?.invoke("progress", json)
    }

    fun emitNext() {
        sink?.invoke("next", "")
    }
}
