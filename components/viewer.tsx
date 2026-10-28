"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DiagramNavigation from "@/components/diagram-navigation";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Braces,
  Check,
  ChevronDown,
  Code2,
  FileCode2,
  Focus,
  GitBranch,
  Grip,
  Maximize,
  Minus,
  PanelLeftClose,
  Pin,
  Plus,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { extractDiagrams, flowExample } from "@/lib/diagrams";

type Drawing = {
  source: string;
  svg: string;
  header: string;
  width: number;
  height: number;
  headerHeight: number;
  sequence: boolean;
};
const storageKey = "mermaid-room.document.v1";

export default function Viewer({ example }: { example: string }) {
  const [source, setSource] = useState(example);
  const [name, setName] = useState("실물 상환 프로세스");
  const [selected, setSelected] = useState(0);
  const [editor, setEditor] = useState(true);
  const [pinned, setPinned] = useState(true);
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [zoom, setZoom] = useState(0.7);
  const [scrolled, setScrolled] = useState(false);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [space, setSpace] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const revision = useRef(0);
  const needsFit = useRef(true);
  const diagrams = extractDiagrams(source);
  const active = diagrams[Math.min(selected, diagrams.length - 1)] || "";

  useEffect(() => {
    const restore = setTimeout(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const data = JSON.parse(saved);
          if (typeof data.source === "string") setSource(data.source);
          if (typeof data.name === "string") setName(data.name);
        }
      } catch {
        /* Storage is optional. */
      }
      setReady(true);
    }, 0);
    const down = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement)?.closest(
          "textarea, input, select, button",
        )
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        setSpace(true);
      }
    };
    const up = () => {
      setSpace(false);
      drag.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", up);
    return () => {
      clearTimeout(restore);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", up);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ source, name }));
      } catch {
        setNotice("브라우저 저장 공간이 부족합니다. 파일로 저장해주세요.");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [source, name, ready]);

  useEffect(() => {
    if (!ready) return;
    const current = ++revision.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        if (!active)
          throw new Error(
            "Mermaid 코드를 입력하면 다이어그램이 여기에 나타납니다.",
          );
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: "Arial, sans-serif",
          suppressErrorRendering: true,
          themeVariables: {
            primaryColor: "#f0f5f2",
            primaryBorderColor: "#8eaaa0",
            primaryTextColor: "#263d35",
            lineColor: "#82968c",
            actorBkg: "#edf4ef",
            actorBorder: "#9db5a7",
            actorTextColor: "#284336",
            actorLineColor: "#bbc9c1",
            signalColor: "#61796b",
            signalTextColor: "#3e5147",
            noteBkgColor: "#fbf7e9",
            noteBorderColor: "#ded6b7",
            noteTextColor: "#655e48",
            labelBoxBkgColor: "#f0f5f2",
            labelBoxBorderColor: "#b9cabe",
            labelTextColor: "#45604e",
            loopTextColor: "#45604e",
            activationBkgColor: "#e1ede4",
            sequenceNumberColor: "#ffffff",
          },
          sequence: {
            useMaxWidth: false,
            mirrorActors: false,
            actorMargin: 65,
            messageMargin: 40,
          },
          flowchart: { useMaxWidth: false, htmlLabels: false },
        });
        const { svg } = await mermaid.render(`diagram-${current}`, active);
        if (revision.current !== current) return;
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        const root = doc.documentElement;
        const box = root.getAttribute("viewBox")!.split(/[ ,]+/).map(Number);
        const width = box[2],
          height = box[3];
        root.removeAttribute("style");
        root.setAttribute("width", String(width));
        root.setAttribute("height", String(height));
        const sequence = /\bsequenceDiagram\b/.test(active);
        // Crop a duplicate of the actual SVG: actor positions and group labels stay identical.
        const actors = [...root.querySelectorAll("rect.actor")];
        const firstRow = Math.min(
          ...actors.map((actor) => Number(actor.getAttribute("y"))),
        );
        let bottom = 0;
        actors.forEach((actor) => {
          const y = Number(actor.getAttribute("y"));
          if (Math.abs(y - firstRow) < 5)
            bottom = Math.max(bottom, y + Number(actor.getAttribute("height")));
        });
        const headerHeight = sequence ? Math.max(85, bottom - box[1] + 12) : 0;
        const full = new XMLSerializer().serializeToString(root);
        const clone = root.cloneNode(true) as SVGElement;
        clone.setAttribute(
          "viewBox",
          `${box[0]} ${box[1]} ${width} ${headerHeight}`,
        );
        clone.setAttribute("height", String(headerHeight));
        // Keep ids unique, including marker references, in the header copy.
        const header = new XMLSerializer()
          .serializeToString(clone)
          .replaceAll(`diagram-${current}`, `header-${current}`);
        setDrawing({
          source: active,
          svg: full,
          header,
          width,
          height,
          headerHeight,
          sequence,
        });
        setError("");
        if (needsFit.current && viewport.current) {
          setZoom(
            Math.min(
              1,
              Math.max(0.05, (viewport.current.clientWidth - 80) / width),
            ),
          );
          viewport.current.scrollTo(0, 0);
          needsFit.current = false;
        }
      } catch (cause) {
        if (revision.current === current)
          setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (revision.current === current) setBusy(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      if (revision.current === current) revision.current = current + 1;
    };
  }, [active, ready]);

  function load(text: string, title: string) {
    needsFit.current = true;
    setSelected(0);
    setName(title);
    setSource(text);
  }
  async function openFile(file?: File) {
    if (!file) return;
    if (!/\.(md|mmd|txt|mermaid)$/i.test(file.name)) {
      setNotice(".md, .mmd, .mermaid, .txt 파일을 열 수 있습니다.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setNotice("1MB 이하의 파일을 선택해주세요.");
      return;
    }
    try {
      load(await file.text(), file.name.replace(/\.[^.]+$/, ""));
    } catch {
      setNotice("파일을 읽지 못했습니다.");
    }
  }
  function scaleTo(value: number, x?: number, y?: number) {
    const el = viewport.current;
    const next = Math.max(0.05, Math.min(3, value));
    if (el) {
      const px = x ?? el.clientWidth / 2,
        py = y ?? el.clientHeight / 2;
      const left = ((el.scrollLeft + px - 40) / zoom) * next + 40 - px;
      const top = ((el.scrollTop + py - 32) / zoom) * next + 32 - py;
      setZoom(next);
      requestAnimationFrame(() =>
        el.scrollTo(Math.max(0, left), Math.max(0, top)),
      );
    }
  }
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      scaleTo(
        zoom * Math.exp(-event.deltaY * 0.01),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
    // The listener uses the current zoom on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  function fit(all = false) {
    if (!drawing || !viewport.current) return;
    const el = viewport.current;
    const ratio = (el.clientWidth - 80) / drawing.width;
    setZoom(
      Math.max(
        0.05,
        Math.min(
          3,
          all
            ? Math.min(ratio, (el.clientHeight - 82) / drawing.height)
            : ratio,
        ),
      ),
    );
    el.scrollTo(0, 0);
  }
  function download(svg = false) {
    if (svg && (!drawing || error)) return;
    const blob = new Blob([svg ? drawing!.svg : source], {
      type: svg ? "image/svg+xml;charset=utf-8" : "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name || "diagram"}.${svg ? "svg" : "md"}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const lines = source.split("\n");

  return (
    <div
      className="app-shell"
      ref={shell}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void openFile(e.dataTransfer.files[0]);
      }}
    >
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Mermaid Room 홈">
          <span className="brand-mark">
            <GitBranch size={22} />
          </span>
          mermaid<span className="brand-light">room</span>
          <span className="beta">BETA</span>
        </Link>
        <div className="top-caption">복잡한 흐름도, 선명하게.</div>
        <button className="button subtle" onClick={() => download()}>
          <ArrowDownToLine size={15} /> Markdown 저장
        </button>
        <button
          className="button primary"
          onClick={() => upload.current?.click()}
        >
          <Upload size={15} /> 파일 열기
        </button>
        <input
          hidden
          ref={upload}
          type="file"
          accept=".md,.mmd,.mermaid,.txt"
          onChange={(e) => {
            void openFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </header>
      <div className="workspace-bar">
        <div className="document-heading">
          <span className="document-icon">
            <FileCode2 size={20} />
          </span>
          <div>
            <input
              aria-label="문서 이름"
              className="document-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <span className="document-meta">
              나의 작업 공간 <span>/</span> Mermaid 다이어그램
            </span>
          </div>
        </div>
        <span className="local-badge">
          <span /> 이 브라우저에 자동 저장
        </span>
        <button
          className={`button ${editor ? "selected" : "subtle"}`}
          onClick={() => setEditor(!editor)}
        >
          <Code2 size={16} /> 코드 {editor ? "접기" : "보기"}
        </button>
      </div>
      <main className={`workspace ${editor ? "with-editor" : ""}`}>
        {editor && (
          <aside className="editor-panel">
            <div className="panel-heading">
              <span>
                <Braces size={16} /> 소스 코드
              </span>
              <button
                className="icon-button"
                title="코드 패널 접기"
                onClick={() => setEditor(false)}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <div className="editor-intro">
              <span className="language-dot" /> MERMAID{" "}
              <span>입력하면 바로 반영됩니다</span>
            </div>
            <div className="code-wrap">
              <div className="line-numbers" aria-hidden="true">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                spellCheck={false}
                aria-label="Mermaid 소스 코드"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setSelected(0);
                }}
              />
            </div>
            <div className="editor-footer">
              <span>UTF-8</span>
              <span>{lines.length} lines</span>
              <span>Markdown 지원</span>
            </div>
            <div className="examples">
              <span className="eyebrow">다른 흐름도 살펴보기</span>
              <button onClick={() => load(flowExample, "제품 개발 플로우")}>
                <span className="example-icon">
                  <GitBranch size={17} />
                </span>
                <span>
                  간단한 플로우차트<small>아이디어에서 출시까지</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
              <button onClick={() => load(example, "실물 상환 프로세스")}>
                <span className="example-icon">
                  <FileCode2 size={17} />
                </span>
                <span>
                  긴 시퀀스 다이어그램
                  <small>참여자 헤더 고정을 경험해보세요</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            </div>
          </aside>
        )}
        <section className="viewer-panel" aria-label="다이어그램 뷰어">
          <div className="viewer-heading">
            <div className="view-label">
              <span className="live-dot" /> 미리보기{" "}
              <span className="type-badge">
                {drawing?.sequence ? "Sequence diagram" : "Diagram"}
              </span>
              {diagrams.length > 1 && (
                <label className="diagram-picker">
                  <select
                    aria-label="다이어그램 선택"
                    value={Math.min(selected, diagrams.length - 1)}
                    onChange={(e) => {
                      needsFit.current = true;
                      setSelected(Number(e.target.value));
                    }}
                  >
                    {diagrams.map((_, i) => (
                      <option key={i} value={i}>
                        다이어그램 {i + 1}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} />
                </label>
              )}
            </div>
            <div className="viewer-actions">
              <button
                className={`button compact ${pinned && drawing?.sequence ? "pin-active" : "subtle"}`}
                disabled={!drawing?.sequence}
                onClick={() => setPinned(!pinned)}
                aria-pressed={pinned && drawing?.sequence}
              >
                <Pin size={14} /> 헤더 고정{" "}
                <span className="toggle-state">
                  {pinned && drawing?.sequence ? "ON" : "OFF"}
                </span>
              </button>
              <span className="divider" />
              <button
                className="icon-button"
                title="SVG 다운로드"
                disabled={!drawing || !!error}
                onClick={() => download(true)}
              >
                <ArrowDownToLine size={16} />
              </button>
              <button
                className="icon-button"
                title="전체 화면"
                onClick={async () => {
                  try {
                    if (document.fullscreenElement)
                      await document.exitFullscreen();
                    else await shell.current?.requestFullscreen();
                  } catch {
                    setNotice(
                      "이 브라우저에서는 전체 화면을 사용할 수 없습니다.",
                    );
                  }
                }}
              >
                <Maximize size={16} />
              </button>
            </div>
          </div>
          {drawing && !error && (
            <DiagramNavigation
              key={drawing.svg}
              source={drawing.source}
              viewport={viewport}
              sequence={drawing.sequence}
              pinned={pinned}
            />
          )}
          <div
            className={`canvas ${space ? "grab" : ""}`}
            ref={viewport}
            tabIndex={0}
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 32)}
            onPointerDown={(e) => {
              if (!space && e.button !== 1) return;
              e.preventDefault();
              const el = e.currentTarget;
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                left: el.scrollLeft,
                top: el.scrollTop,
              };
              el.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              e.currentTarget.scrollLeft =
                drag.current.left - (e.clientX - drag.current.x);
              e.currentTarget.scrollTop =
                drag.current.top - (e.clientY - drag.current.y);
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {error ? (
              <div className="error-card" role="alert">
                <Code2 size={25} />
                <h2>
                  {active
                    ? "코드를 조금만 확인해주세요"
                    : "새로운 흐름을 그려보세요"}
                </h2>
                <p>
                  {active
                    ? "Mermaid 구문을 수정하면 미리보기가 자동으로 다시 표시됩니다."
                    : "왼쪽 편집기에 코드를 붙여넣거나 파일을 끌어놓으세요."}
                </p>
                <pre>{error}</pre>
                {!editor && (
                  <button className="button" onClick={() => setEditor(true)}>
                    코드 보기
                  </button>
                )}
              </div>
            ) : (
              drawing && (
                <div
                  className="diagram-space"
                  style={{
                    width: Math.max(drawing.width * zoom + 80, 0),
                    minWidth: "100%",
                    minHeight: "100%",
                  }}
                >
                  {pinned && drawing.sequence && (
                    <div
                      aria-hidden="true"
                      className={`sticky-header ${scrolled ? "visible" : ""}`}
                      style={{ width: drawing.width * zoom }}
                    >
                      <div
                        className="header-crop"
                        style={{
                          width: drawing.width * zoom,
                          height: drawing.headerHeight * zoom,
                        }}
                      >
                        <div
                          style={{
                            transform: `scale(${zoom})`,
                            transformOrigin: "top left",
                            width: drawing.width,
                          }}
                          dangerouslySetInnerHTML={{ __html: drawing.header }}
                        />
                      </div>
                    </div>
                  )}
                  <div
                    className="diagram"
                    style={{
                      width: drawing.width * zoom,
                      height: drawing.height * zoom,
                    }}
                  >
                    <div
                      style={{
                        width: drawing.width,
                        height: drawing.height,
                        transform: `scale(${zoom})`,
                        transformOrigin: "top left",
                      }}
                      dangerouslySetInnerHTML={{ __html: drawing.svg }}
                    />
                  </div>
                </div>
              )
            )}
            {busy && (
              <div className="rendering" role="status">
                <span className="spinner" /> 다이어그램 그리는 중
              </div>
            )}
          </div>
          <div className="canvas-bottom">
            <span>
              <Grip size={13} /> Space + 드래그로 이동{" "}
              <span className="hint-separator">·</span> ⌘ / Ctrl + 휠로 확대
            </span>
            <div className="zoom-tools">
              <button
                className="icon-button"
                title="축소"
                onClick={() => scaleTo(zoom / 1.2)}
              >
                <Minus size={15} />
              </button>
              <button
                className="zoom-value"
                title="100%로 보기"
                onClick={() => scaleTo(1)}
              >
                {Math.round(zoom * 100)}
                <span>%</span>
              </button>
              <button
                className="icon-button"
                title="확대"
                onClick={() => scaleTo(zoom * 1.2)}
              >
                <Plus size={15} />
              </button>
              <span className="divider" />
              <button className="button compact subtle" onClick={() => fit()}>
                <Focus size={15} /> 너비 맞춤
              </button>
              <button
                className="icon-button"
                title="전체 다이어그램 보기"
                onClick={() => fit(true)}
              >
                <Maximize size={15} />
              </button>
              <button
                className="icon-button"
                title="처음 위치로"
                onClick={() =>
                  viewport.current?.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: "smooth",
                  })
                }
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </section>
      </main>
      <footer className="app-footer">
        <span>
          <span className="footer-dot" /> 생각의 흐름을 놓치지 마세요.
        </span>
        <span>
          코드는 이 브라우저에만 저장됩니다{" "}
          <span className="footer-divider">/</span>
          <GitBranch size={12} /> Mermaid로 그립니다
        </span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
          <button
            className="icon-button"
            title="닫기"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
