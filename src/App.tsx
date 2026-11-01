"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  Download,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Check,
  ArrowRight,
  Sliders,
  X,
  FileCode,
} from "lucide-react";

// 対応フォーマット定義
type TargetFormat = "image/png" | "image/jpeg" | "image/webp" | "image/avif";

interface FormatOption {
  id: TargetFormat;
  label: string;
  ext: string;
  supportsQuality: boolean;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: "image/png", label: "PNG", ext: "png", supportsQuality: false },
  { id: "image/jpeg", label: "JPG", ext: "jpg", supportsQuality: true },
  { id: "image/webp", label: "WebP", ext: "webp", supportsQuality: true },
  { id: "image/avif", label: "AVIF", ext: "avif", supportsQuality: true },
];

const ACCEPTED_INPUT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "image/gif",
  "image/bmp",
];

type AppState = "idle" | "ready" | "converting" | "done";

export default function ImageConverter() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);

  // 変換パラメータ
  const [targetFormat, setTargetFormat] = useState<TargetFormat>("image/webp");
  const [quality, setQuality] = useState<number>(85);

  // 変換結果
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ファイルサイズ整形ヘルパー
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  };

  // ファイル読み込み処理
  const handleFile = useCallback((file: File) => {
    // 拡張子またはMIMEチェック
    if (!ACCEPTED_INPUT_TYPES.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|avif|svg|gif|bmp)$/i)) {
      return;
    }

    // 前のプレビューを破棄
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (convertedUrl) URL.revokeObjectURL(convertedUrl);

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageMeta({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = objectUrl;

    setSourceFile(file);
    setPreviewUrl(objectUrl);
    setConvertedBlob(null);
    setConvertedUrl(null);
    setAppState("ready");
  }, [previewUrl, convertedUrl]);

  // クリップボード貼り付け (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            handleFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFile]);

  // ドラッグ＆ドロップイベント
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // 変換実行 (Canvas API)
  const executeConversion = async () => {
    if (!sourceFile || !previewUrl) return;

    setAppState("converting");

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = previewUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("Canvas context is unavailable");

      // 透過画像をJPGに変換する場合は白背景を敷く
      if (targetFormat === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      // CanvasからBlobへの変換
      const q = targetFormat === "image/png" ? undefined : quality / 100;
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setAppState("ready");
            return;
          }
          const downloadUrl = URL.createObjectURL(blob);
          setConvertedBlob(blob);
          setConvertedUrl(downloadUrl);
          // 少しだけアニメーションの余韻を持たせる
          setTimeout(() => setAppState("done"), 400);
        },
        targetFormat,
        q
      );
    } catch (err) {
      console.error("Conversion failed:", err);
      setAppState("ready");
    }
  };

  // リセット処理
  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (convertedUrl) URL.revokeObjectURL(convertedUrl);
    setSourceFile(null);
    setPreviewUrl(null);
    setConvertedBlob(null);
    setConvertedUrl(null);
    setImageMeta(null);
    setAppState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ダウンロード実行
  const handleDownload = () => {
    if (!convertedUrl || !sourceFile) return;
    const currentOption = FORMAT_OPTIONS.find((f) => f.id === targetFormat);
    const baseName = sourceFile.name.substring(0, sourceFile.name.lastIndexOf(".")) || "image";
    const ext = currentOption?.ext || "png";

    const a = document.createElement("a");
    a.href = convertedUrl;
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const currentOption = FORMAT_OPTIONS.find((f) => f.id === targetFormat);
  const sizeDiffPercent =
    sourceFile && convertedBlob
      ? Math.round(((convertedBlob.size - sourceFile.size) / sourceFile.size) * 100)
      : 0;

  return (
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative min-h-screen w-full bg-[#0a0a0c] text-neutral-100 flex items-center justify-center p-4 md:p-8 font-sans selection:bg-white/20 overflow-hidden"
    >
      {/* 背景の微細なアンビエントライティング */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-gradient-to-tr from-indigo-500/10 via-purple-500/5 to-transparent blur-[120px] rounded-full" />
      </div>

      {/* 微細なノイズ/グリッドオーバーレイ */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* 隠しinput */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_INPUT_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        }}
      />

      {/* メインカードコンテナ */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 350, damping: 32 }}
        className="relative z-10 w-full max-w-[480px] bg-neutral-900/60 backdrop-blur-2xl rounded-3xl border border-white/[0.08] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.02)] p-6 overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {/* 1. 初期状態 (アップロード待機) */}
          {appState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={() => fileInputRef.current?.click()}
              className={`group relative flex flex-col items-center justify-center py-16 px-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${isDragging
                  ? "border-indigo-500 bg-indigo-500/[0.05] scale-[1.02]"
                  : "border-white/[0.1] hover:border-white/[0.25] hover:bg-white/[0.02]"
                }`}
            >
              {/* アイコン */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="w-14 h-14 rounded-2xl bg-neutral-800/80 border border-white/[0.08] flex items-center justify-center text-neutral-300 group-hover:text-white group-hover:border-white/[0.2] transition-colors shadow-inner mb-4"
              >
                <UploadCloud className="w-6 h-6 stroke-[1.75]" />
              </motion.div>

              <h2 className="text-base font-medium tracking-tight text-neutral-200 group-hover:text-white transition-colors">
                Drop an image or click to browse
              </h2>
              <p className="mt-1 text-xs text-neutral-400 font-mono tracking-tight">
                or press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-neutral-300">Ctrl</kbd> +{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-neutral-300">V</kbd> to paste
              </p>

              {/* 対応拡張子ピル */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                {["PNG", "JPG", "WebP", "AVIF", "SVG", "GIF"].map((fmt) => (
                  <span
                    key={fmt}
                    className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-400"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* 2 & 3. プレビュー & 形式選択 / 変換中 */}
          {(appState === "ready" || appState === "converting") && previewUrl && (
            <motion.div
              key="ready-converting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* ヘッダー: 閉じるボタンとファイル情報 */}
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-neutral-400">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-medium text-neutral-200 truncate max-w-[240px]">
                      {sourceFile?.name}
                    </p>
                    <p className="text-[10px] font-mono text-neutral-400">
                      {sourceFile ? formatBytes(sourceFile.size) : ""}
                      {imageMeta ? ` • ${imageMeta.width}×${imageMeta.height}px` : ""}
                    </p>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleReset}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* プレビュー表示エリア */}
              <div className="relative aspect-[16/10] w-full rounded-2xl bg-neutral-950/70 border border-white/[0.06] overflow-hidden flex items-center justify-center">
                {/* チェックパターン背景（透過用） */}
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage: `linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)`,
                    backgroundSize: `16px 16px`,
                    backgroundPosition: `0 0, 0 8px, 8px -8px, -8px 0px`,
                  }}
                />

                <img
                  src={previewUrl}
                  alt="Source Preview"
                  className="relative z-10 max-h-full max-w-full object-contain p-2 select-none"
                />

                {/* 変換中オーバーレイ */}
                {appState === "converting" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-20 bg-neutral-950/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                      className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full"
                    />
                    <p className="text-xs font-mono text-neutral-300 tracking-wider">
                      CONVERTING...
                    </p>
                  </motion.div>
                )}
              </div>

              {/* 設定エリア: 出力フォーマット (Segmented Control) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-mono uppercase tracking-wider text-[11px]">Format</span>
                  <span className="text-[11px] text-neutral-400">Export as</span>
                </div>

                <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded-xl border border-white/[0.08] backdrop-blur-md">
                  {FORMAT_OPTIONS.map((fmt) => {
                    const isActive = targetFormat === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setTargetFormat(fmt.id)}
                        className={`relative py-2 text-xs font-medium rounded-lg transition-all duration-200 z-10 ${
                          isActive
                            ? "text-white font-semibold drop-shadow-sm"
                            : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]"
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="active-indicator"
                            transition={{ type: "spring", stiffness: 480, damping: 36 }}
                            className="absolute inset-0 bg-gradient-to-b from-white/[0.14] to-white/[0.04] rounded-lg border border-white/[0.18] shadow-[0_2px_12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] -z-10"
                          />
                        )}
                        {fmt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 設定エリア: クオリティスライダー (JPG, WebP, AVIF時のみ) */}
              <AnimatePresence>
                {currentOption?.supportsQuality && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono uppercase tracking-wider text-[11px] text-neutral-400">
                        Quality
                      </span>
                      <span className="font-mono text-xs text-neutral-300">{quality}%</span>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={quality}
                        onChange={(e) => setQuality(Number(e.target.value))}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 変換アクションボタン */}
              <motion.button
                whileHover={{ scale: 1.012, translateY: -1 }}
                whileTap={{ scale: 0.985 }}
                onClick={executeConversion}
                disabled={appState === "converting"}
                className="group relative w-full mt-3 py-3.5 px-5 rounded-2xl overflow-hidden font-medium text-xs tracking-wide flex items-center justify-center gap-2 text-white transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none shadow-[0_10px_30px_-8px_rgba(99,102,241,0.4),0_0_0_1px_rgba(255,255,255,0.12)] bg-gradient-to-b from-indigo-500 via-indigo-600 to-indigo-700 hover:shadow-[0_14px_36px_-6px_rgba(99,102,241,0.55),0_0_0_1px_rgba(255,255,255,0.22)]"
              >
                {/* ボタン内トップハイライトライン */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
                {/* 繊細な光沢アニメーション */}
                <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

                <Sparkles className="w-3.5 h-3.5 fill-white/80 text-white transition-transform duration-300 group-hover:rotate-12" />
                <span className="font-medium drop-shadow-sm">Convert to {currentOption?.label}</span>
              </motion.button>
            </motion.div>
          )}

          {/* 4. 完了状態 (結果比較 & ダウンロード) */}
          {appState === "done" && convertedBlob && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="space-y-6"
            >
              {/* ステータスバッジ */}
              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
                  className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 shadow-[0_0_24px_rgba(16,185,129,0.2)]"
                >
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </motion.div>
                <h3 className="text-base font-medium text-neutral-100">Conversion Complete</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Ready for instant download</p>
              </div>

              {/* サイズ比較カード */}
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-white/[0.06] flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                    Original
                  </span>
                  <p className="text-sm font-mono text-neutral-300">
                    {sourceFile ? formatBytes(sourceFile.size) : "-"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-neutral-400" />
                  <span
                    className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${sizeDiffPercent <= 0
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                  >
                    {sizeDiffPercent <= 0 ? `${sizeDiffPercent}%` : `+${sizeDiffPercent}%`}
                  </span>
                </div>

                <div className="space-y-1 text-right">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                    {currentOption?.label}
                  </span>
                  <p className="text-sm font-mono font-medium text-white">
                    {formatBytes(convertedBlob.size)}
                  </p>
                </div>
              </div>

              {/* ダウンロード & リセットボタン */}
              <div className="space-y-2.5 pt-1">
                <motion.button
                  whileHover={{ scale: 1.012, translateY: -1 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={handleDownload}
                  className="group relative w-full py-3.5 px-5 rounded-2xl overflow-hidden font-medium text-xs tracking-wide flex items-center justify-center gap-2 text-white shadow-[0_10px_30px_-8px_rgba(16,185,129,0.4),0_0_0_1px_rgba(255,255,255,0.12)] bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:shadow-[0_14px_36px_-6px_rgba(16,185,129,0.55),0_0_0_1px_rgba(255,255,255,0.22)] transition-all duration-300"
                >
                  {/* トップハイライトライン */}
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
                  {/* 光沢アニメーション */}
                  <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

                  <Download className="w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 group-hover:-translate-y-0.5" />
                  <span className="font-medium drop-shadow-sm">Download Image</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={handleReset}
                  className="w-full py-2.5 px-4 rounded-xl text-xs text-neutral-400 hover:text-neutral-100 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-neutral-400 group-hover:rotate-180 transition-transform duration-300" />
                  <span>Convert another</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}