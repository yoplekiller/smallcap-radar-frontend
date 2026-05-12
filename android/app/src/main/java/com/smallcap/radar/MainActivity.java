package com.smallcap.radar;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        // 캐시 비활성화: 항상 서버에서 최신 콘텐츠 로드
        webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
        // 네이티브 오버스크롤 제거: 웹 pull-to-refresh와 충돌 방지
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
    }
}
