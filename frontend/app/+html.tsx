// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /*
                Use the *dynamic* viewport height so the app shell tracks the
                mobile browser's collapsing/expanding toolbars instead of the
                (taller) layout viewport — otherwise the bottom navigation ends
                up underneath Chrome/Safari's bottom UI. 100% is the fallback
                for browsers without dvh support.
              */
              html, body { height: 100%; height: 100dvh; }
              body > div:first-child {
                position: fixed !important;
                top: 0; left: 0; right: 0; bottom: 0;
                height: 100%;
                /*
                  --app-vh follows visualViewport (see script below) so the
                  shell also shrinks when the on-screen keyboard opens on
                  mobile web; dvh/100% are progressive fallbacks.
                */
                height: 100dvh;
                height: var(--app-vh, 100dvh);
                box-sizing: border-box;
                overflow: hidden;
                overscroll-behavior: none;
              }
              /* Never allow accidental horizontal scrolling of the shell. */
              html, body { overflow-x: hidden; max-width: 100%; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
        {/*
          Track the visual viewport so the app shell resizes when the mobile
          browser toolbars collapse or the on-screen keyboard opens. One pair of
          listeners for the whole app — nothing to clean up, nothing per-screen.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              var vv = window.visualViewport;
              if (!vv) return;
              var raf = 0;
              var apply = function(){
                raf = 0;
                document.documentElement.style.setProperty('--app-vh', vv.height + 'px');
              };
              var onChange = function(){ if (!raf) raf = requestAnimationFrame(apply); };
              vv.addEventListener('resize', onChange);
              vv.addEventListener('scroll', onChange);
              window.addEventListener('orientationchange', onChange);
              apply();
            })();`,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
