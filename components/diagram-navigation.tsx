"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronDown, ChevronUp, List, Search, X } from "lucide-react";
import {
  extractSections,
  linkSections,
  normalizeLabel,
} from "@/lib/navigation";

type Entry = {
  element: SVGGraphicsElement;
  label: string;
  normalized: string;
  y: number;
};
type Props = {
  source: string;
  viewport: RefObject<HTMLDivElement | null>;
  sequence: boolean;
  pinned: boolean;
};

function visibleLabel(element: Element) {
  const spans = [...element.querySelectorAll("tspan")];
  return (
    spans.length
      ? spans.map((span) => span.textContent).join(" ")
      : element.textContent || ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

export default function DiagramNavigation({
  source,
  viewport,
  sequence,
  pinned,
}: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [outline, setOutline] = useState(false);
  const [sectionTarget, setSectionTarget] = useState<Entry | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const term = normalizeLabel(query);
  const matches = term
    ? entries.filter((entry) => entry.normalized.includes(term))
    : [];
  const current = matches.length ? Math.min(cursor, matches.length - 1) : 0;
  const sections = sequence ? extractSections(source) : [];
  const linkedSections = linkSections(sections, entries);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const svg =
        viewport.current?.querySelector<SVGSVGElement>(".diagram svg");
      if (!svg) return;
      const nodes = [
        ...svg.querySelectorAll<SVGGraphicsElement>("text, foreignObject"),
      ];
      setEntries(
        nodes
          .filter(
            (element) =>
              !element.closest("defs") &&
              !element.parentElement?.closest("foreignObject"),
          )
          .map((element) => {
            const label = visibleLabel(element);
            return {
              element,
              label,
              normalized: normalizeLabel(label),
              y: element.getBoundingClientRect().top,
            };
          })
          .filter((entry) => entry.label)
          .sort((a, b) => a.y - b.y),
      );
    });
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "f" &&
        !(event.target as HTMLElement)?.closest("textarea")
      ) {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", shortcut);
    };
  }, [viewport]);

  useEffect(() => {
    if (!outline) return;
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOutline(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [outline]);

  function jump(entry: Entry) {
    const el = viewport.current;
    if (!el || !entry.element.isConnected) return;
    const rect = entry.element.getBoundingClientRect();
    const canvas = el.getBoundingClientRect();
    const headerHeight = pinned
      ? el.querySelector(".header-crop")?.getBoundingClientRect().height || 0
      : 0;
    el.scrollTo({
      top: Math.max(
        0,
        el.scrollTop + rect.top - canvas.top - headerHeight - 38,
      ),
      left: Math.max(
        0,
        el.scrollLeft +
          rect.left -
          canvas.left -
          (el.clientWidth - Math.min(rect.width, el.clientWidth - 48)) / 2,
      ),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  useEffect(() => {
    if (!term || !matches[current]) return;
    const frame = requestAnimationFrame(() => jump(matches[current]));
    return () => cancelAnimationFrame(frame);
    // Only navigation inputs trigger scrolling; moving around the canvas does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cursor, entries, pinned]);

  // This decorates the mounted SVG only. Exported SVG remains free of search highlights.
  useEffect(() => {
    const svg = viewport.current?.querySelector<SVGSVGElement>(".diagram svg");
    if (!svg) return;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("aria-hidden", "true");
    group.setAttribute("class", "navigation-highlights");
    const targets = term ? matches : sectionTarget ? [sectionTarget] : [];
    const selected = term ? matches[current] : sectionTarget;
    const inverse = svg.getScreenCTM()?.inverse();
    if (inverse)
      for (const entry of targets) {
        const bounds = entry.element.getBoundingClientRect();
        const start = new DOMPoint(bounds.left, bounds.top).matrixTransform(
          inverse,
        );
        const end = new DOMPoint(bounds.right, bounds.bottom).matrixTransform(
          inverse,
        );
        const rect = document.createElementNS(svg.namespaceURI, "rect");
        rect.setAttribute("x", String(start.x - 5));
        rect.setAttribute("y", String(start.y - 4));
        rect.setAttribute("width", String(end.x - start.x + 10));
        rect.setAttribute("height", String(end.y - start.y + 8));
        rect.setAttribute("rx", "3");
        rect.setAttribute(
          "class",
          entry === selected ? "navigation-current" : "navigation-match",
        );
        group.appendChild(rect);
      }
    svg.appendChild(group);
    return () => group.remove();
    // DOM measurements are converted into SVG coordinates, so zoom/scroll keep highlights aligned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, query, cursor, sectionTarget, viewport]);

  function navigate(index: number) {
    if (!matches.length) return;
    const next = (index + matches.length) % matches.length;
    setCursor(next);
    setSectionTarget(null);
  }

  return (
    <div className="navigation-bar">
      <div className="outline-control" ref={panel}>
        <button
          className={`button compact ${outline ? "selected" : "subtle"}`}
          aria-expanded={outline}
          aria-controls="diagram-outline"
          onClick={() => setOutline(!outline)}
        >
          <List size={15} /> 단계 목차{" "}
          <span className="section-count">{sections.length}</span>
          <ChevronDown size={12} />
        </button>
        {outline && (
          <div
            className="outline-popover"
            id="diagram-outline"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOutline(false);
                panel.current?.querySelector("button")?.focus();
              }
            }}
          >
            <div className="outline-title">
              단계별로 이동<small>번호 또는 #으로 시작하는 단계 주석</small>
            </div>
            {linkedSections.length ? (
              <ol>
                {linkedSections.map((section) => (
                  <li key={section.line}>
                    <button
                      disabled={!section.target}
                      title={
                        section.target
                          ? `${section.line}번째 줄 · ${section.target.label}`
                          : "이 단계에서 연결할 수 있는 메시지를 찾지 못했습니다"
                      }
                      onClick={() => {
                        if (!section.target) return;
                        setQuery("");
                        setCursor(0);
                        setSectionTarget(section.target);
                        jump(section.target);
                        setOutline(false);
                      }}
                    >
                      <span>{section.title}</span>
                      <small>
                        {section.target ? `L${section.line}` : "위치 없음"}
                      </small>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p>
                {sequence
                  ? "%% 1. 단계 이름 또는 %% # 단계 이름 주석을 추가하면 목차가 만들어집니다."
                  : "단계 목차는 시퀀스 다이어그램에서 지원합니다. 검색으로 노드와 연결 내용을 찾아보세요."}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="diagram-search">
        <Search size={14} />
        <input
          ref={input}
          aria-label="다이어그램 검색"
          placeholder="메시지, API, 참여자 검색"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCursor(0);
            setSectionTarget(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              navigate(current + (event.shiftKey ? -1 : 1));
            }
            if (event.key === "Escape") {
              setQuery("");
              setCursor(0);
              input.current?.blur();
            }
          }}
        />
        <span className="search-count" role="status" aria-live="polite">
          {term
            ? matches.length
              ? `${current + 1} / ${matches.length}`
              : "결과 없음"
            : "⌘ / Ctrl F"}
        </span>
        <button
          className="icon-button"
          title="이전 검색 결과 (Shift+Enter)"
          disabled={!matches.length}
          onClick={() => navigate(current - 1)}
        >
          <ChevronUp size={14} />
        </button>
        <button
          className="icon-button"
          title="다음 검색 결과 (Enter)"
          disabled={!matches.length}
          onClick={() => navigate(current + 1)}
        >
          <ChevronDown size={14} />
        </button>
        {query && (
          <button
            className="icon-button"
            title="검색 지우기"
            onClick={() => {
              setQuery("");
              setCursor(0);
              input.current?.focus();
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>
      {term && matches[current] && (
        <button
          className="search-result-label"
          title={matches[current].label}
          onClick={() => jump(matches[current])}
        >
          {matches[current].label}
        </button>
      )}
    </div>
  );
}
