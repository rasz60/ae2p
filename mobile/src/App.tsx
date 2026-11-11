import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { APP_VERSION, bridgeScript, handleRequest, parseRequest } from './bridge';
import { HOME, isInternal, isOAuthStart, signInWithSystemBrowser } from './navigation';

void SplashScreen.preventAutoHideAsync();

// 포털 로딩 화면과 같은 바탕색 (스플래시 → 웹 첫 화면이 끊기지 않게)
const COLORS = {
  light: { bg: '#F6F5FB', text: '#1E1E28', muted: '#5F6378', button: '#1E1E28', buttonText: '#FFFFFF' },
  dark: { bg: '#14152A', text: '#ECEBFA', muted: '#A4A6C2', button: '#ECEBFA', buttonText: '#14152A' },
};

/**
 * ae:p 앱: 포털(https://ae2p.duckdns.org) 과 그 아래 모든 앱을 WebView 하나로 연다.
 * 로그인 세션은 WebView 안(localStorage)에 남아 앱을 다시 열어도 그대로다.
 * 앱만 하는 일: Google · 카카오 로그인을 시스템 창으로, 다른 사이트 링크는 사파리로, Apple 건강 읽기(bridge.ts).
 */
const App = () => {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = COLORS[scheme];
  const ref = useRef<WebView>(null);
  const [uri, setUri] = useState<string>(HOME);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // 안드로이드 뒤로 버튼 (iOS 는 가장자리 밀기)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      ref.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onShouldStart = useCallback((req: ShouldStartLoadRequest): boolean => {
    if (isOAuthStart(req.url)) {
      void signInWithSystemBrowser(req.url).then((next) => next && setUri(next));
      return false;
    }
    if (isInternal(req.url)) return true;
    // iframe 안에서 불러오는 것(지도 · 동영상 등)은 그대로, 사람이 누른 다른 사이트 링크는 사파리로
    if (req.isTopFrame === false) return true;
    void Linking.openURL(req.url).catch(() => undefined);
    return false;
  }, []);

  const onMessage = useCallback(async (data: string) => {
    const req = parseRequest(data);
    if (!req) return;
    ref.current?.injectJavaScript(await handleRequest(req));
  }, []);

  const retry = () => {
    setFailed(null);
    setNonce((n) => n + 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style="auto" />
      {failed ? (
        <View style={styles.center}>
          <Text style={[styles.title, { color: c.text }]}>ae:p 에 연결하지 못했어요</Text>
          <Text style={[styles.body, { color: c.muted }]}>{failed}</Text>
          <Text style={[styles.body, { color: c.muted }]}>인터넷 연결을 확인하고 다시 시도해 주세요.</Text>
          <Pressable onPress={retry} style={({ pressed }) => [styles.button, { backgroundColor: c.button, opacity: pressed ? 0.75 : 1 }]}>
            <Text style={[styles.buttonText, { color: c.buttonText }]}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={nonce}
          ref={ref}
          source={{ uri }}
          style={{ backgroundColor: c.bg }}
          // 페이지마다 노치 · 홈 막대 여백을 스스로 잡는다 (viewport-fit=cover) — 앱은 화면 전체를 준다
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          sharedCookiesEnabled
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          decelerationRate="normal"
          applicationNameForUserAgent={`aep-ios/${APP_VERSION}`}
          injectedJavaScriptBeforeContentLoaded={bridgeScript()}
          onShouldStartLoadWithRequest={onShouldStart}
          onMessage={(e) => void onMessage(e.nativeEvent.data)}
          onNavigationStateChange={(nav: WebViewNavigation) => setCanGoBack(nav.canGoBack)}
          onLoadEnd={() => void SplashScreen.hideAsync()}
          onError={(e) => {
            void SplashScreen.hideAsync();
            setFailed(e.nativeEvent.description || '페이지를 불러오지 못했어요.');
          }}
          // 웹이 메모리 부족으로 꺼지면 다시 띄운다 (빈 흰 화면 방지)
          onContentProcessDidTerminate={() => ref.current?.reload()}
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.bg }]}>
              <ActivityIndicator color={c.muted} />
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: { marginTop: 16, height: 50, paddingHorizontal: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});

export default App;
