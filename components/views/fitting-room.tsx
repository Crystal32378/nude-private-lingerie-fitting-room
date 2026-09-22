"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { getProductById } from "@/lib/products";
import { emptyFrame, type SituationFrame, type TradeoffResult } from "@/lib/fitting/types";
import { byField, byId, hintsFromUtterance, mentionsDailyRotation } from "@/lib/fitting/questions";
import { askText, productName, CHOICE_LABEL, choiceText, noteText, reasonText, UI, whyText, type Lang } from "@/lib/fitting/i18n";
import { decide, planNextAction, recommendStyles } from "@/lib/fitting/decide";
import { buildBasketOptions, buildBudgetComparison, type BudgetComparison } from "@/lib/fitting/promotion";
import { buildTaskRequest, projectTradeoffState, type TaskField } from "@/lib/fitting/privacy";
import { PANTY_SIZE_CHART } from "@/lib/fitting/panties";

const CORE: TaskField[] = ["canReachBackClosure", "needsNudeColourway", "requiresNoVisibleLines", "priority",
  "matchingSetDesired", "quantityIntent", "budgetMaxTwd"];
const EXTRA: TaskField[] = ["canRaiseArmsOverhead", "canPerformFineMotorPinch", "canRotateBandAroundTorso", "canPassOverHead", "basketPriority"];
const money = (n: number) => `NT$${n.toLocaleString("zh-TW")}`;
const button = "min-h-11 border border-primary bg-primary px-5 py-3 text-sm text-primary-foreground transition-colors hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-40";
const secondary = "min-h-11 border border-border px-4 py-3 text-sm hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function FittingRoomView() {
  // Never stored, submitted, logged, or included in the task request.
  const [utterance, setUtterance] = useState("");
  const [started, setStarted] = useState(false);
  const [hints, setHints] = useState<string[]>([]);
  const [frame, setFrame] = useState<SituationFrame>(emptyFrame);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(true);
  const [records, setRecords] = useState<Record<string, TradeoffResult>>({});
  const [pending, setPending] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [size, setSize] = useState<string>("");
  // Presentation only. Switching never touches answers, records or selection.
  const [lang, setLang] = useState<Lang>("en");
  const t = UI[lang];
  const choiceLabel = CHOICE_LABEL[lang];

  const attempted = new Set(Object.keys(records));
  const action = planNextAction(frame, attempted, records[JSON.stringify(projectTradeoffState("style_tradeoff", frame))]);
  const judgeKey = !editing && action.kind === "judge" ? action.key : null;
  const judgeTask = action.kind === "judge" ? action.task : null;
  useEffect(() => {
    if (!judgeKey || !judgeTask || inFlight.current || records[judgeKey]) return;
    const key = judgeKey, task = judgeTask;
    inFlight.current = key;
    setPending(key);
    // Only this explicitly projected request crosses the network.
    fetch("/api/fitting/judge", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildTaskRequest(task, frame)), cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("unavailable");
        const result = await response.json() as TradeoffResult;
        if (result.task !== task || !["complete", "skipped", "unavailable"].includes(result.status) || !Array.isArray(result.judgments)) throw new Error("invalid result");
        return result;
      })
      .catch((): TradeoffResult => ({ task, status: "unavailable", judgments: [] }))
      .then(result => {
        // Results are tied to the immutable request key. A late response can never
        // overwrite the recommendation for newer user answers.
        setRecords(previous => ({ ...previous, [key]: result }));
        inFlight.current = null;
        setPending(null);
      });
  }, [judgeKey, judgeTask, frame, records, pending]);

  const styleProjection = projectTradeoffState("style_tradeoff", frame);
  const basketProjection = projectTradeoffState("basket_tradeoff", frame);
  const styleResult = styleProjection ? records[JSON.stringify(styleProjection)] : undefined;
  const basketResult = basketProjection ? records[JSON.stringify(basketProjection)] : undefined;
  const decisions = decide(frame);
  const styles = recommendStyles(frame, styleResult);
  const open = decisions.items.filter(i => i.bucket === "check_with_you"
    && getProductById(i.productId)!.price * (frame.quantityIntent.value ?? 1) <= (frame.budgetMaxTwd.value ?? Infinity))
    .slice(0, Math.max(0, 3 - styles.length));
  const excluded = decisions.items.filter(i => i.bucket === "not_a_fit").slice(0, 2);
  const baskets = buildBasketOptions(frame);
  const preferredStyles = styleResult?.judgments.filter(j => j.status === "judged" && j.choice === "prefer") ?? [];
  const rulePreferredBasket = preferredStyles.length === 1 && styleResult?.judgments.every(j => j.status === "judged")
    ? baskets.find(b => !b.needsReview && b.braId === preferredStyles[0].targetId
      && b.calculation.defaultTotal === baskets[0]?.calculation.defaultTotal)?.id : undefined;
  const modelPreferredBasket = basketResult?.judgments.find(j => j.status === "judged")?.choice;
  const preferredBasket = modelPreferredBasket ?? rulePreferredBasket;
  const visibleBaskets = [...baskets].sort((a, b) => Number(b.id === preferredBasket) - Number(a.id === preferredBasket)).slice(0, 3);
  const selection = baskets.find(b => b.id === selected);
  const comparisonBasket = selection ?? baskets[0];
  const budgetComparison: BudgetComparison | null = comparisonBasket ? buildBudgetComparison(comparisonBasket) : null;
  const hasSet = frame.matchingSetDesired.value === true;
  const loading = pending !== null;
  const failed = styleResult?.status === "unavailable" || basketResult?.status === "unavailable";
  const canConfirm = CORE.every(key => draft[key] !== undefined && draft[key] !== "");
  const visibleExtra = EXTRA.filter(field => field === "canRaiseArmsOverhead" || field === "canPerformFineMotorPinch"
    || frame[field].provenance === "confirmed");

  function answer(field: TaskField, value: unknown) {
    setSelected(null);
    setDraft(previous => ({ ...previous, [field]: JSON.stringify(value) }));
    setFrame(previous => ({ ...previous, [field]: { value, provenance: "confirmed" } } as SituationFrame));
  }
  function confirm() {
    const next = { ...frame };
    for (const field of [...CORE, ...EXTRA.filter(key => draft[key])]) {
      const value = JSON.parse(draft[field]);
      Object.assign(next, { [field]: { value, provenance: "confirmed" } });
    }
    for (const field of EXTRA) if (draft[field] === "") Object.assign(next, { [field]: { value: null, provenance: "unknown" } });
    setFrame(next); setEditing(false); setSelected(null);
  }
  function fillExample() {
    setStarted(true); setEditing(true); setSelected(null);
    setDraft({ canReachBackClosure: "true", needsNudeColourway: "true", requiresNoVisibleLines: "false",
      priority: '"balanced"', matchingSetDesired: "false", quantityIntent: "2", budgetMaxTwd: "5000" });
  }

  return <div className="min-h-screen bg-background text-foreground" lang={lang === "en" ? "en" : "zh-Hant-TW"}>
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Link href="/" aria-label={t.catalogAria}><Logo height={20} /></Link>
        <div className="flex items-center gap-5">
          <button type="button" className="min-h-11 py-3 text-sm underline underline-offset-4" aria-label={t.langSwitchAria}
            onClick={() => setLang(lang === "en" ? "zh" : "en")}>{t.langSwitch}</button>
          <Link href="/" className="min-h-11 py-3 text-sm underline underline-offset-4">{t.backToCatalog}</Link>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16">
      <div className="mb-10 max-w-2xl">
        <p className="mb-4 text-sm text-muted-foreground">Private Fitting Room</p>
        <h1 className="text-3xl font-normal leading-snug sm:text-4xl">{t.h1}</h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">{t.lede}</p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label={t.needsAria} className="min-w-0">
          <label htmlFor="life-context" className="mb-3 block text-lg">{t.contextLabel}</label>
          <textarea id="life-context" value={utterance} onChange={event => {
            setUtterance(event.target.value);
            if (started) { setHints(hintsFromUtterance(event.target.value)); setEditing(true); setSelected(null); }
          }} rows={3}
            autoComplete="off" spellCheck={false} maxLength={2000}
            placeholder={t.placeholder}
            className="w-full resize-y border border-border bg-card px-4 py-3 text-base leading-7 focus:outline-2 focus:outline-primary" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.privacy}</p>
          {!started && <div className="mt-5 flex flex-wrap gap-3">
            <button className={button} onClick={() => { setStarted(true); setHints(hintsFromUtterance(utterance)); }}>{t.confirmNeeds}</button>
            <button className={secondary} onClick={fillExample}>{t.fillExample}</button>
          </div>}
          {started && <div className="mt-7 border-t border-border pt-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl">{t.firstThings}</h2>
              {!editing && <button className={secondary} onClick={() => { setEditing(true); setSelected(null); }}>{t.editAnswers}</button>}
            </div>
            {editing ? <form onSubmit={event => { event.preventDefault(); if (canConfirm) confirm(); }}>
              {hints.length > 0 && <p className="mb-5 text-sm leading-6 text-muted-foreground">{t.hintsNote}</p>}
              <div className="grid gap-5 sm:grid-cols-2">
                {CORE.map(field => {
                  const question = byField(field)!;
                  const choices = field === "priority" ? [...question.choices, { label: "沒有特別偏好", value: "not_stated" }] : question.choices;
                  const withPanty = draft.matchingSetDesired === "true";
                  return <label key={field} className="block text-sm leading-6">
                    <span className="mb-2 block">{t.labels[field]}</span>
                    <select aria-label={t.labels[field]} value={draft[field] ?? ""}
                      onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))}
                      className="min-h-12 w-full border border-border bg-card px-3 text-base focus:outline-2 focus:outline-primary">
                      <option value="">{t.choose}</option>
                      {choices.map((choice, index) => <option key={index} value={JSON.stringify(choice.value)}>
                        {field === "quantityIntent" ? t.qtyOption(choice.value as number, withPanty) : choiceText(question, choice.value, choice.label, lang)}
                      </option>)}
                    </select>
                  </label>;
                })}
              </div>
              <details className="mt-5 text-sm" open={hints.includes("q_overhead") || undefined}>
                <summary className="cursor-pointer py-3 underline underline-offset-4">{t.extraSummary}</summary>
                <div className="grid gap-5 pt-3 sm:grid-cols-2">{visibleExtra.map(field => <label key={field} className="block leading-6">
                  {askText(byField(field), lang)}
                  <select value={draft[field] ?? ""} onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))}
                    className="mt-2 min-h-12 w-full border border-border bg-card px-3 text-base focus:outline-2 focus:outline-primary">
                    <option value="">{t.notProvided}</option>{byField(field)?.choices.map((choice, index) => <option key={index} value={JSON.stringify(choice.value)}>{choiceText(byField(field), choice.value, choice.label, lang)}</option>)}
                  </select>
                </label>)}</div>
              </details>
              <p className="my-5 text-sm leading-6 text-muted-foreground">{t.budgetNote}</p>
              <button type="submit" className={button} disabled={!canConfirm}>{t.submit}</button>
            </form> : <div className="flex flex-wrap gap-2">
              {CORE.map(field => <span key={field} className="border border-border bg-card px-3 py-2 text-sm">
                {field === "quantityIntent" ? t.qtyChip(frame.quantityIntent.value!, hasSet)
                  : field === "budgetMaxTwd" ? t.ceilingChip(frame.budgetMaxTwd.value!)
                  : (() => { const q = byField(field); const c = q?.choices.find(x => x.value === frame[field].value);
                      return `${t.short[field]}${lang === "en" ? ": " : "："}${c ? choiceText(q, c.value, c.label, lang) : t.noPreference}`; })()}
              </span>)}
            </div>}
          </div>}
        </section>

        <aside className="border-l-2 border-accent pl-5 lg:sticky lg:top-8" aria-label={t.asideAria}>
          <h2 className="text-lg">{t.asideTitle}</h2>
          <div role="status" aria-live="polite" className="mt-3 text-sm leading-7 text-muted-foreground">
            {!started || editing ? t.asideIdle
              : loading ? t.asideLoading
              : action.kind === "ask" ? whyText(byField(action.field), lang) ?? t.asideAsk
              : failed ? t.asideFailed
              : t.asideDone}
          </div>
          {!editing && action.kind === "ask" && <fieldset className="mt-4">
            <legend className="mb-3 text-sm leading-6">{askText(byField(action.field), lang)}</legend>
            <div className="flex flex-col gap-2">{byField(action.field)?.choices.map((choice, index) =>
              <button key={index} className={`${secondary} text-left`} onClick={() => answer(action.field, choice.value)}>{choiceText(byField(action.field), choice.value, choice.label, lang)}</button>)}</div>
          </fieldset>}
        </aside>
      </div>

      {started && !editing && <>
        <section className="mt-14 border-t border-border pt-8" aria-labelledby="style-title">
          <h2 id="style-title" className="text-2xl">{t.stylesTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {styles.length ? t.stylesCount(styles.length) : t.stylesNone}
            {styleResult?.status === "complete" ? t.jevNote : ""}
          </p>
          {failed && <p role="status" className="mt-4 border-l-2 border-accent pl-4 text-sm leading-7">{t.partialFail}</p>}
          <div className="mt-7 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[...styles, ...open].map(item => {
              const product = getProductById(item.productId)!;
              const judgment = styleResult?.judgments.find(j => j.targetId === product.id);
              return <article key={product.id} className="min-w-0">
                <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
                  <Image src={product.displayImage} alt={productName(product.id, lang)} fill sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw" className="object-cover" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t.photoNote}</p>
                <p className="mt-4 text-sm text-muted-foreground">{item.bucket === "check_with_you" ? t.needsCheck : judgment ? judgment.status === "judged" ? choiceLabel[judgment.choice] ?? choiceLabel.insufficient_evidence : choiceLabel.insufficient_evidence : t.fitsConfirmed}</p>
                <h3 className="mt-2 text-lg leading-7">{productName(product.id, lang)}</h3>
                <p className="mt-2 text-sm">{money(product.price)} <span className="text-muted-foreground">{t.perItem}</span></p>
                <ul className="mt-3 space-y-1 text-sm leading-6 text-muted-foreground">
                  {item.reasons.filter(r => r.field !== "price").slice(0, 2).map(reason => <li key={reason.field}>{reasonText(reason, lang)}</li>)}
                </ul>
                {item.openQuestion && <p className="mt-3 text-sm leading-6">{askText(byId(item.openQuestion.id), lang) || item.openQuestion.ask}</p>}
                {item.uncertain.map(note => <p key={note} className="mt-3 text-sm leading-6">{noteText(note, lang)}</p>)}
                {item.bucket !== "check_with_you" && <details open className="mt-4 border-t border-border pt-3 text-sm">
                  <summary className="cursor-pointer underline underline-offset-4">{t.distSummary}</summary>
                  {judgment ? <>
                    <p className="my-2 text-xs leading-5 text-muted-foreground">{t.distNote}</p>
                    {Object.entries(judgment.probabilities).map(([key, value]) => <div key={key} className="flex justify-between gap-3 py-1"><span>{choiceLabel[key] ?? choiceLabel.insufficient_evidence}</span><span>{Math.round(value * 100)}%</span></div>)}
                    {styleResult?.provenance?.receiptId && <p className="mt-2 break-all text-xs text-muted-foreground">{t.receipt(styleResult.provenance.receiptId, styleResult.provenance.returnedModel)}</p>}
                  </> : <p className="my-2 text-xs leading-5 text-muted-foreground">{loading ? t.jevPending : t.jevNone}</p>}
                </details>}
                <a className="mt-4 inline-block min-h-11 py-3 text-sm underline underline-offset-4" href={product.productUrl} target="_blank" rel="noreferrer">{t.viewProduct}</a>
              </article>;
            })}
          </div>
          {excluded.length > 0 && <details className="mt-8 border-t border-border pt-4 text-sm">
            <summary className="cursor-pointer py-2">{t.whyExcluded}</summary>
            {excluded.map(item => <p key={item.productId} className="my-3 leading-6"><span>{productName(item.productId, lang)}{lang === "en" ? ": " : "："}</span>{item.reasons.map(r => reasonText(r, lang)).join(lang === "en" ? "; " : "；")}</p>)}
          </details>}
          <p className="mt-5 text-sm leading-6 text-muted-foreground">{t.seamlessNote}</p>
        </section>

        <section className="mt-12 border-t border-border pt-8" aria-labelledby="basket-title">
          <h2 id="basket-title" className="text-2xl">{t.basketTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{t.basketIntro(frame.quantityIntent.value!, hasSet)}</p>
          {basketResult?.status === "complete" && <details className="mt-4 text-sm">
            <summary className="cursor-pointer py-2 underline underline-offset-4">{t.basketDist}</summary>
            <p className="my-2 text-xs leading-5 text-muted-foreground">{t.basketDistNote}{!preferredBasket ? t.basketUndecided : ""}</p>
            {Object.entries(basketResult.judgments[0]?.probabilities ?? {}).map(([id, probability]) => <p key={id} className="py-1 leading-6">
              {id === "insufficient_evidence" ? t.insufficient : baskets.find(b => b.id === id)?.lines.map(l => `${productName(l.id, lang, l.name)} × ${l.qty}`).join(lang === "en" ? " + " : " ＋ ") ?? t.candidate}{lang === "en" ? ": " : "："}{Math.round(probability * 100)}%
            </p>)}
            {basketResult.provenance?.receiptId && <p className="mt-1 break-all text-xs text-muted-foreground">{t.receipt(basketResult.provenance.receiptId, basketResult.provenance.returnedModel)}</p>}
          </details>}
          {baskets.length === 0 ? <p className="mt-6 border border-border bg-card p-5 leading-7">{t.noBasket}</p>
            : <div className="mt-6 space-y-4">{visibleBaskets.map(basket => <article key={basket.id} className="border border-border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-xl">
                  <p className="text-sm text-muted-foreground">{basket.needsReview ? t.draftSet : basket.id === preferredBasket ? modelPreferredBasket ? t.jevSuggests : t.ruleAgrees : basket.id === baskets[0].id ? t.lowest : t.another}</p>
                  <h3 className="mt-2 text-lg leading-7">{basket.lines.map(line => `${productName(line.id, lang, line.name)} × ${line.qty}`).join(lang === "en" ? " + " : " ＋ ")}</h3>
                </div>
                <div><p className="text-xl">{money(basket.calculation.defaultTotal)}</p><p className="mt-1 text-xs text-muted-foreground">{basket.calculation.savings > 0 ? t.activityWas(basket.calculation.preDiscountTotal) : t.setTotal}{t.shippingLater}</p></div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.vsLowest(basket.calculation.defaultTotal - baskets[0].calculation.defaultTotal)}{lang === "en" ? " " : ""}{basket.unknowns.map(u => noteText(u, lang)).join(lang === "en" ? "; " : "；")}</p>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer py-2 underline underline-offset-4">{t.basis}</summary>
                <p className="leading-6 text-muted-foreground">{t.basisLine(basket.calculation.preDiscountTotal, basket.calculation.eligibleItemCount, t.tier[basket.calculation.appliedTier], basket.calculation.finalTotal)}</p>
                <p className="mt-2 leading-6 text-muted-foreground">{t.basisSource}</p>
              </details>
              <button className={`${secondary} mt-4`} onClick={() => setSelected(basket.id)} aria-pressed={selected === basket.id}>
                {selected === basket.id ? t.kept : basket.needsReview ? t.keepDraft : t.chooseThis}
              </button>
            </article>)}</div>}
          {budgetComparison && <PriceDecisionPanel comparison={budgetComparison} dailyNeed={mentionsDailyRotation(utterance)} lang={lang} />}
          {selection && <div className="mt-6 border-l-2 border-primary pl-5" role="status">
            <h3 className="text-lg">{t.heldTitle}</h3>
            <p className="mt-2 text-sm leading-7">{selection.needsReview ? t.heldDraft : t.heldGo}{t.heldTotal(selection.calculation.defaultTotal)}</p>
            {hasSet && <label className="mt-4 block text-sm">{t.sizeLabel}
              <select value={size} onChange={e => setSize(e.target.value)} className="ml-0 mt-2 block min-h-11 border border-border bg-card px-3">
                <option value="">{t.sizeNone}</option>{Object.entries(PANTY_SIZE_CHART).map(([key, range]) => <option key={key} value={key}>{key}　{lang === "en" ? range.replace("吋", "in") : range}</option>)}
              </select>
            </label>}
          </div>}
        </section>
      </>}
    </main>
    <section className="border-t border-border px-5 py-10 sm:px-8" aria-label="Fit Receipt on Product Hunt">
      <div className="mx-auto flex max-w-6xl justify-center">
        <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', border: "1px solid rgb(224, 224, 224)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 500, background: "rgb(255, 255, 255)", boxShadow: "rgba(0, 0, 0, 0.05) 0px 2px 8px", textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <img
              alt="Fit Receipt"
              src="https://ph-files.imgix.net/3202a550-77df-4a67-991e-77111ebe7d05.png?auto=compress,format&codec=mozjpeg&cs=strip&fit=crop&h=80&w=80"
              width={64}
              height={64}
              style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
            />
            <div style={{ flex: "1 1 0%", minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "rgb(26, 26, 26)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Fit Receipt</h3>
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "rgb(102, 102, 102)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>A private fitting agent that knows when to call JEV</p>
            </div>
          </div>
          <a
            href="https://www.producthunt.com/products/fit-receipt?embed=true&utm_source=embed&utm_medium=post_embed"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 12, padding: "8px 16px", background: "rgb(255, 97, 84)", color: "rgb(255, 255, 255)", textDecoration: "none", borderRadius: 9999, fontSize: 16, fontWeight: 600, lineHeight: 1.5 }}
          >
            Check it out on Product Hunt →
          </a>
        </div>
      </div>
    </section>
    <footer className="border-t border-border px-5 py-8 text-center text-sm leading-7 text-muted-foreground">{t.footer}</footer>
  </div>;
}

function PriceDecisionPanel({ comparison, dailyNeed, lang }: { comparison: BudgetComparison; dailyNeed: boolean; lang: Lang }) {
  const p = UI[lang].price;
  const rate = (zh: string) => p.rate[zh] ?? zh;
  const rows = [comparison.oneSet, comparison.threeBras, comparison.threeSets];
  return <section className="mt-8 border-l-2 border-accent bg-card p-5 sm:p-7" aria-labelledby="price-decision-title">
    <p className="text-sm text-muted-foreground">{p.eyebrow}</p>
    <h3 id="price-decision-title" className="mt-2 text-2xl">{p.title}</h3>
    <p className="mt-3 text-sm leading-7 text-muted-foreground">{p.intro}</p>
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <div className="border border-border p-4">
        <p className="text-xs text-muted-foreground">{p.oneList}</p>
        <p className="mt-2 text-2xl">{money(comparison.oneSet.originalTotal)}</p>
        <p className="mt-1 text-sm">{p.noDiscount}</p>
      </div>
      <div className="border border-border p-4">
        <p className="text-xs text-muted-foreground">{p.oneActivity}</p>
        <p className="mt-2 text-2xl">{money(comparison.oneSet.conditionalSimulation)}</p>
        <p className="mt-1 text-sm">{p.oneActivityNote(rate(comparison.oneSet.rateLabel))}</p>
      </div>
      <div className="border border-border p-4">
        <p className="text-xs text-muted-foreground">{p.threeSets}</p>
        <p className="mt-2 text-2xl">{money(comparison.threeSets.conditionalSimulation)}</p>
        <p className="mt-1 text-sm">{p.avg(comparison.threeSetsConditionalAveragePerSet)}</p>
        <p className="mt-1 text-sm">{p.moreThanOne(comparison.threeSets.deltaFromOneSet)}</p>
      </div>
    </div>
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <caption className="sr-only">{p.caption}</caption>
        <thead><tr className="border-b border-border text-muted-foreground">
          <th className="py-3 pr-4 font-normal">{p.plan}</th>
          <th className="px-4 py-3 font-normal">{p.list}</th>
          <th className="px-4 py-3 font-normal">{p.activity}</th>
          <th className="py-3 pl-4 font-normal">{p.vsOne}</th>
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className="border-b border-border last:border-0">
          <th className="py-3 pr-4 font-normal">{p.rows[row.id] ?? row.label}</th>
          <td className="px-4 py-3">{money(row.originalTotal)}</td>
          <td className="px-4 py-3">{money(row.conditionalSimulation)}{lang === "en" ? ` (${rate(row.rateLabel)})` : `（${row.rateLabel}）`}</td>
          <td className="py-3 pl-4">{row.deltaFromOneSet === 0 ? p.base : p.more(row.deltaFromOneSet)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="mt-5 text-sm leading-7 text-muted-foreground">{p.outro(comparison.threeSets.deltaFromOneSet)}</p>
    {dailyNeed && <p className="mt-3 text-sm leading-7">{p.daily(comparison.threeSetsConditionalAveragePerSet)}</p>}
  </section>;
}
