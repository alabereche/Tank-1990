package com.battlecity1990.arcade;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            // Keep screen on during arcade battle sessions
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Ensure GPU hardware acceleration is active on WebView
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

                WebSettings webSettings = webView.getSettings();
                webSettings.setDomStorageEnabled(true);
                webSettings.setDatabaseEnabled(true);
                webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
            }
        } catch (Exception ignored) {
        }
    }
}
