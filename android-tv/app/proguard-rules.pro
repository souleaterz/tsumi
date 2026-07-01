# Keep the JS ↔ native bridge intact — R8 must not rename @JavascriptInterface methods.
-keepclassmembers class com.tsumi.tv.TsumiNative {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class org.videolan.libvlc.** { *; }
-keep class com.github.se_bastiaan.torrentstream.** { *; }
