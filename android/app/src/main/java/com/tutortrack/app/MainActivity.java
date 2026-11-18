package com.tutortrack.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.CookieManager;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupSharePlugin.class);
        super.onCreate(savedInstanceState);
        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
    }

    @Override
    public void onPause() {
        CookieManager.getInstance().flush();
        super.onPause();
    }
}
