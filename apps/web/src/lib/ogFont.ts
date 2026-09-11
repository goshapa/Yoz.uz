// Дефолтный шрифт в next/og (ImageResponse) на Windows падает при сборке файлового
// пути к встроенному Noto Sans — подключаем Manrope (тот же шрифт, что и в остальном
// приложении) сами, это заодно и обходит баг, и держит логотип в фирменном стиле.
let cached: ArrayBuffer | null = null;

export async function manropeBold(): Promise<ArrayBuffer> {
  if (cached) return cached;

  const css = await fetch("https://fonts.googleapis.com/css2?family=Manrope:wght@800&text=Y").then((r) =>
    r.text(),
  );
  const match = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
  if (!match) throw new Error("Не удалось найти URL шрифта Manrope");

  const buffer = await fetch(match[1]).then((r) => r.arrayBuffer());
  cached = buffer;
  return buffer;
}
