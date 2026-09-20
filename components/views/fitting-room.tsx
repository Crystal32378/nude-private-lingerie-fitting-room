"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { getProductById } from "@/lib/products";
import { emptyFrame, type SituationFrame, type TradeoffResult } from "@/lib/fitting/types";
import { byField, hintsFromUtterance } from "@/lib/fitting/questions";
import { decide, planNextAction, recommendStyles } from "@/lib/fitting/decide";
import { buildBasketOptions } from "@/lib/fitting/promotion";
import { buildTaskRequest, projectTradeoffState, type TaskField } from "@/lib/fitting/privacy";
import { PANTY_SIZE_CHART } from "@/lib/fitting/panties";

const CORE: TaskField[] = ["canReachBackClosure", "needsNudeColourway", "requiresNoVisibleLines", "priority",
  "matchingSetDesired", "quantityIntent", "budgetMaxTwd"];
const EXTRA: TaskField[] = ["canRaiseArmsOverhead", "canPerformFineMotorPinch", "canRotateBandAroundTorso", "canPassOverHead", "basketPriority"];
const LABELS: Record<string, string> = {
  canReachBackClosure: "背扣好操作嗎？", needsNudeColourway: "需要裸色嗎？",
  requiresNoVisibleLines: "完全無痕是必要條件嗎？", priority: "這次更重視什麼？",
  matchingSetDesired: "需要搭配內褲嗎？", quantityIntent: "這次需要的數量", budgetMaxTwd: "整組預算上限",
};
const CHOICES: Record<string, string> = { prefer: "優先考慮", consider: "可以考慮，有取捨", lower_priority: "偏好排序較後", insufficient_evidence: "取捨仍待確認" };
const SHORT_LABELS: Record<string, string> = { canReachBackClosure: "背扣", needsNudeColourway: "裸色", requiresNoVisibleLines: "無痕", priority: "偏好", matchingSetDesired: "配套" };
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

  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Link href="/" aria-label="NUDE 商品目錄"><Logo height={20} /></Link>
        <Link href="/" className="min-h-11 py-3 text-sm underline underline-offset-4">回商品目錄</Link>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16">
      <div className="mb-10 max-w-2xl">
        <p className="mb-4 text-sm text-muted-foreground">Private Fitting Room</p>
        <h1 className="text-3xl font-normal leading-snug sm:text-4xl">先說生活，再選內衣。</h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">先了解妳要怎麼穿，再看款式與整組預算。可以修改任何答案，最後由妳決定。</p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="妳的需求" className="min-w-0">
          <label htmlFor="life-context" className="mb-3 block text-lg">這次想解決什麼？</label>
          <textarea id="life-context" value={utterance} onChange={event => {
            setUtterance(event.target.value);
            if (started) { setHints(hintsFromUtterance(event.target.value)); setEditing(true); setSelected(null); }
          }} rows={3}
            autoComplete="off" spellCheck={false} maxLength={2000}
            placeholder="例如：出差要穿白襯衫，背扣不好操作，想搭配一套。"
            className="w-full resize-y border border-border bg-card px-4 py-3 text-base leading-7 focus:outline-2 focus:outline-primary" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">這段文字只留在這次瀏覽的裝置記憶體，不會傳給模型。後面的選項才是妳確認的需求。</p>
          {!started && <div className="mt-5 flex flex-wrap gap-3">
            <button className={button} onClick={() => { setStarted(true); setHints(hintsFromUtterance(utterance)); }}>確認我的需求</button>
            <button className={secondary} onClick={fillExample}>填入示範條件</button>
          </div>}
          {started && <div className="mt-7 border-t border-border pt-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl">先確認重要的事</h2>
              {!editing && <button className={secondary} onClick={() => { setEditing(true); setSelected(null); }}>修改條件</button>}
            </div>
            {editing ? <form onSubmit={event => { event.preventDefault(); if (canConfirm) confirm(); }}>
              {hints.length > 0 && <p className="mb-5 text-sm leading-6 text-muted-foreground">妳的描述提供了提問線索。這裡不替妳推定限制，請選出妳確認的答案。</p>}
              <div className="grid gap-5 sm:grid-cols-2">
                {CORE.map(field => {
                  const question = byField(field)!;
                  const choices = field === "priority" ? [...question.choices, { label: "沒有特別偏好", value: "not_stated" }] : question.choices;
                  const withPanty = draft.matchingSetDesired === "true";
                  return <label key={field} className="block text-sm leading-6">
                    <span className="mb-2 block">{LABELS[field]}</span>
                    <select aria-label={LABELS[field]} value={draft[field] ?? ""}
                      onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))}
                      className="min-h-12 w-full border border-border bg-card px-3 text-base focus:outline-2 focus:outline-primary">
                      <option value="">請選擇</option>
                      {choices.map((choice, index) => <option key={index} value={JSON.stringify(choice.value)}>
                        {field === "quantityIntent" ? `${choice.value} ${withPanty ? "套（內衣＋內褲）" : "件內衣"}` : choice.label}
                      </option>)}
                    </select>
                  </label>;
                })}
              </div>
              <details className="mt-5 text-sm" open={hints.includes("q_overhead") || undefined}>
                <summary className="cursor-pointer py-3 underline underline-offset-4">其他需要留意的穿脫操作（選填）</summary>
                <div className="grid gap-5 pt-3 sm:grid-cols-2">{visibleExtra.map(field => <label key={field} className="block leading-6">
                  {byField(field)?.ask}
                  <select value={draft[field] ?? ""} onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))}
                    className="mt-2 min-h-12 w-full border border-border bg-card px-3 text-base focus:outline-2 focus:outline-primary">
                    <option value="">尚未提供</option>{byField(field)?.choices.map((choice, index) => <option key={index} value={JSON.stringify(choice.value)}>{choice.label}</option>)}
                  </select>
                </label>)}</div>
              </details>
              <p className="my-5 text-sm leading-6 text-muted-foreground">預算是整組上限，不是最低消費。需要幾件由妳決定，不會為了折扣自動加購。</p>
              <button type="submit" className={button} disabled={!canConfirm}>確認，幫我看看</button>
            </form> : <div className="flex flex-wrap gap-2">
              {CORE.map(field => <span key={field} className="border border-border bg-card px-3 py-2 text-sm">
                {field === "quantityIntent" ? `${frame.quantityIntent.value} ${hasSet ? "套" : "件內衣"}`
                  : field === "budgetMaxTwd" ? `整組上限 ${money(frame.budgetMaxTwd.value!)}`
                  : `${SHORT_LABELS[field]}：${byField(field)?.choices.find(c => c.value === frame[field].value)?.label ?? "沒有特別偏好"}`}
              </span>)}
            </div>}
          </div>}
        </section>

        <aside className="border-l-2 border-accent pl-5 lg:sticky lg:top-8" aria-label="現在可以做什麼">
          <h2 className="text-lg">現在，我們先看這件事</h2>
          <div role="status" aria-live="polite" className="mt-3 text-sm leading-7 text-muted-foreground">
            {!started || editing ? "先確認真正影響妳選擇的條件，不需要把整份問卷填完。"
              : loading ? "正在比較已符合條件的選項。商品資料與價格仍由程式核對。"
              : action.kind === "ask" ? byField(action.field)?.why ?? "這個答案會影響眼前的選擇。"
              : failed ? "這次模型判斷沒有完成。仍可看商品事實、計算組合，或修改條件。"
              : "有足夠資訊就交給妳選；不知道的地方會留下來，不替妳猜。"}
          </div>
          {!editing && action.kind === "ask" && <fieldset className="mt-4">
            <legend className="mb-3 text-sm leading-6">{byField(action.field)?.ask}</legend>
            <div className="flex flex-col gap-2">{byField(action.field)?.choices.map((choice, index) =>
              <button key={index} className={`${secondary} text-left`} onClick={() => answer(action.field, choice.value)}>{choice.label}</button>)}</div>
          </fieldset>}
        </aside>
      </div>

      {started && !editing && <>
        <section className="mt-14 border-t border-border pt-8" aria-labelledby="style-title">
          <h2 id="style-title" className="text-2xl">哪些款式值得看</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {styles.length ? `${styles.length} 款可先比較，依已確認的條件與偏好呈現。` : "目前沒有已確認符合所有必要條件的款式。可以先確認下列問題，或修改條件。"}
            {styleResult?.status === "complete" ? " JEV 提供的是取捨參考，不是穿著效果保證。" : ""}
          </p>
          {failed && <p role="status" className="mt-4 border-l-2 border-accent pl-4 text-sm leading-7">部分模型比較未完成，以下保留商品事實與程式計價。妳仍可選擇或修改條件。</p>}
          <div className="mt-7 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[...styles, ...open].map(item => {
              const product = getProductById(item.productId)!;
              const judgment = styleResult?.judgments.find(j => j.targetId === product.id);
              return <article key={product.id} className="min-w-0">
                <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
                  <Image src={product.displayImage} alt={product.nameZh} fill sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw" className="object-cover" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">官方商品照；照片顏色不代表所選色系。</p>
                <p className="mt-4 text-sm text-muted-foreground">{item.bucket === "check_with_you" ? "需要確認" : judgment ? judgment.status === "judged" ? CHOICES[judgment.choice] : "取捨仍待確認" : "符合已確認條件"}</p>
                <h3 className="mt-2 text-lg leading-7">{product.nameZh}</h3>
                <p className="mt-2 text-sm">{money(product.price)} <span className="text-muted-foreground">／件，記錄價格</span></p>
                <ul className="mt-3 space-y-1 text-sm leading-6 text-muted-foreground">
                  {item.reasons.filter(r => r.field !== "price").slice(0, 2).map(reason => <li key={reason.field}>{reason.text}</li>)}
                </ul>
                {item.openQuestion && <p className="mt-3 text-sm leading-6">{item.openQuestion.ask}</p>}
                {item.uncertain.map(note => <p key={note} className="mt-3 text-sm leading-6">{note}</p>)}
                {judgment && <details className="mt-4 text-sm">
                  <summary className="cursor-pointer underline underline-offset-4">查看判斷分布</summary>
                  <p className="my-2 text-xs leading-5 text-muted-foreground">Prototype judgment：這是選項分布，不是穿著合適率。</p>
                  {Object.entries(judgment.probabilities).map(([key, value]) => <div key={key} className="flex justify-between gap-3 py-1"><span>{CHOICES[key]}</span><span>{Math.round(value * 100)}%</span></div>)}
                </details>}
                <a className="mt-4 inline-block min-h-11 py-3 text-sm underline underline-offset-4" href={product.productUrl} target="_blank" rel="noreferrer">查看官方商品</a>
              </article>;
            })}
          </div>
          {excluded.length > 0 && <details className="mt-8 border-t border-border pt-4 text-sm">
            <summary className="cursor-pointer py-2">為什麼有些款式沒列入？</summary>
            {excluded.map(item => <p key={item.productId} className="my-3 leading-6"><span>{getProductById(item.productId)?.nameZh}：</span>{item.reasons.map(r => r.text).join("；")}</p>)}
          </details>}
          <p className="mt-5 text-sm leading-6 text-muted-foreground">裸色不代表薄白襯衫下無痕；目前沒有這項實測。庫存與到貨時間也尚未確認。</p>
        </section>

        <section className="mt-12 border-t border-border pt-8" aria-labelledby="basket-title">
          <h2 id="basket-title" className="text-2xl">怎麼組合，符合妳這次的需要</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">以妳確認的 {frame.quantityIntent.value} {hasSet ? "套" : "件內衣"} 計算，預設用原價。活動條款尚未核定，模擬折扣不會拿來通過預算檢查。</p>
          {basketResult?.status === "complete" && <details className="mt-4 text-sm">
            <summary className="cursor-pointer py-2 underline underline-offset-4">查看組合判斷分布</summary>
            <p className="my-2 text-xs leading-5 text-muted-foreground">Prototype judgment：比較已確認需求的取捨，不是省錢或合適程度的保證。{!preferredBasket ? "目前還無法判定哪組更符合偏好。" : ""}</p>
            {Object.entries(basketResult.judgments[0]?.probabilities ?? {}).map(([id, probability]) => <p key={id} className="py-1 leading-6">
              {id === "insufficient_evidence" ? "證據不足" : baskets.find(b => b.id === id)?.lines.map(l => `${l.name} × ${l.qty}`).join(" ＋ ") ?? "候選組合"}：{Math.round(probability * 100)}%
            </p>)}
          </details>}
          {baskets.length === 0 ? <p className="mt-6 border border-border bg-card p-5 leading-7">目前這個數量，沒有同時通過條件與整組預算的組合。可以修改條件；我們不會自動減少數量或加入不合的款式。</p>
            : <div className="mt-6 space-y-4">{visibleBaskets.map(basket => <article key={basket.id} className="border border-border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-xl">
                  <p className="text-sm text-muted-foreground">{basket.needsReview ? "配套草稿，待品牌核對" : basket.id === preferredBasket ? modelPreferredBasket ? "JEV 建議優先比較這組" : "款式偏好與最低總額一致" : basket.id === baskets[0].id ? "目前商品合計最低" : "另一個合格組合"}</p>
                  <h3 className="mt-2 text-lg leading-7">{basket.lines.map(line => `${line.name} × ${line.qty}`).join(" ＋ ")}</h3>
                </div>
                <div><p className="text-xl">{money(basket.calculation.defaultTotal)}</p><p className="mt-1 text-xs text-muted-foreground">整組商品合計／運費另確認</p></div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">比最低商品合計{basket.calculation.defaultTotal === baskets[0].calculation.defaultTotal ? "相同" : `多 ${money(basket.calculation.defaultTotal - baskets[0].calculation.defaultTotal)}`}。{basket.unknowns.join("；")}</p>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer py-2 underline underline-offset-4">價格與活動依據</summary>
                <p className="leading-6 text-muted-foreground">記錄日期：2026-09-20。原價合計 {money(basket.calculation.preDiscountTotal)}。已核定活動資格 {basket.calculation.eligibleItemCount} 件。</p>
                <p className="mt-2 leading-6 text-muted-foreground">{basket.calculation.eligibleItemCount > 0 ? `條件式活動模擬 ${money(basket.calculation.finalTotal)}，不套入預設總額。` : "指定商品資格未核定，暫不計折扣。"}完整活動條款尚待核對，主張期限 2026-10-15（台北時間），非 live 查詢。</p>
              </details>
              <button className={`${secondary} mt-4`} onClick={() => setSelected(basket.id)} aria-pressed={selected === basket.id}>
                {selected === basket.id ? "已保留這組" : basket.needsReview ? "保留草稿，向品牌確認" : "我想選這組"}
              </button>
            </article>)}</div>}
          {selection && <div className="mt-6 border-l-2 border-primary pl-5" role="status">
            <h3 className="text-lg">已保留妳的選擇，尚未下單。</h3>
            <p className="mt-2 text-sm leading-7">{selection.needsReview ? "配套資料仍需品牌確認。" : "可以前往官方商品頁自行決定。"}商品合計 {money(selection.calculation.defaultTotal)}；庫存、運費與結帳優惠以官網確認為準。</p>
            {hasSet && <label className="mt-4 block text-sm">依官方對照，請自行確認內褲尺碼
              <select value={size} onChange={e => setSize(e.target.value)} className="ml-0 mt-2 block min-h-11 border border-border bg-card px-3">
                <option value="">尚未選擇</option>{Object.entries(PANTY_SIZE_CHART).map(([key, range]) => <option key={key} value={key}>{key}　{range}</option>)}
              </select>
            </label>}
          </div>}
        </section>
      </>}
    </main>
    <footer className="border-t border-border px-5 py-8 text-center text-sm leading-7 text-muted-foreground">先懂妳的需求，再比較證據與取捨。最後，由妳決定。</footer>
  </div>;
}
