import { getDocument, GlobalWorkerOptions, type PDFPageProxy } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerSrc;

export interface ExtratoTransacao {
  idExterno: string;
  data: string;
  dataOriginal: string;
  descricao: string;
  valor: number;
  tipo: "saida" | "entrada";
  rawText?: string;
  pagina?: number;
}

interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
}

interface TextLine {
  y: number;
  items: PositionedTextItem[];
}

interface TransactionDateMatch {
  index: number;
  value: string;
}

const DATE_BEFORE_ID_PATTERN = /(\d{2}\/\d{2}\/\d{4})\s+(?=#\d{10})/g;
const ID_PATTERN = /#\d{10}/g;
const MONEY_PATTERN = /([+-])\s*R\$\s*([\d.]+,\d{2})/g;
const LINE_TOLERANCE = 4;

const parseBrazilianValue = (value: string): number =>
  Number(value.replace(/\./g, "").replace(",", "."));

const toIsoDate = (date: string): string => {
  const [day, month, year] = date.split("/");
  return `${year}-${month}-${day}`;
};

const normalizeText = (text: string): string => text.replace(/\s+/g, " ").trim();

const readInput = async (input: File | ArrayBuffer): Promise<ArrayBuffer> => {
  if (input instanceof ArrayBuffer) return input;
  return input.arrayBuffer();
};

const isTextItem = (item: unknown): item is { str: string; transform: number[] } => {
  if (!item || typeof item !== "object") return false;
  const candidate = item as { str?: unknown; transform?: unknown };
  return typeof candidate.str === "string" && Array.isArray(candidate.transform) && candidate.transform.length >= 6;
};

const getPositionedItems = (page: PDFPageProxy): Promise<PositionedTextItem[]> =>
  page.getTextContent().then((content) =>
    content.items.reduce<PositionedTextItem[]>((items, item) => {
      if (isTextItem(item) && item.str.trim().length > 0) {
        items.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
        });
      }
      return items;
    }, [])
  );

const groupIntoLines = (items: PositionedTextItem[]): TextLine[] => {
  const lines: TextLine[] = [];

  for (const item of items) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= LINE_TOLERANCE);
    if (line) {
      line.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  return lines
    .map((line) => ({
      y: line.y,
      items: line.items.sort((first, second) => first.x - second.x),
    }))
    .sort((first, second) => second.y - first.y);
};

const getPageText = (lines: TextLine[]): string =>
  lines.map((line) => line.items.map((item) => item.str).join(" ")).join(" ");

const getTransactionDateMatches = (pageText: string): TransactionDateMatch[] =>
  Array.from(pageText.matchAll(DATE_BEFORE_ID_PATTERN)).map((match) => ({
    index: match.index ?? 0,
    value: match[1],
  }));

export async function parseRecargaPayPdf(input: File | ArrayBuffer): Promise<ExtratoTransacao[]> {
  const pdf = await getDocument({ data: await readInput(input) }).promise;
  const transactions: ExtratoTransacao[] = [];
  let currentDate: string | undefined;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const positionedItems = await getPositionedItems(page);
    const lines = groupIntoLines(positionedItems);
    const pageText = getPageText(lines);
    const dates = getTransactionDateMatches(pageText);
    const ids = Array.from(pageText.matchAll(ID_PATTERN));
    let dateIndex = 0;

    for (let index = 0; index < ids.length; index += 1) {
      const idMatch = ids[index];
      const idStart = idMatch.index ?? 0;
      const nextIdStart = ids[index + 1]?.index ?? pageText.length;

      while (dateIndex < dates.length && (dates[dateIndex].index ?? 0) < idStart) {
        currentDate = dates[dateIndex].value;
        dateIndex += 1;
      }

      if (!currentDate) continue;

      const rawText = pageText.slice(idStart, nextIdStart);
      const moneyMatches = Array.from(rawText.matchAll(MONEY_PATTERN));
      const moneyMatch = moneyMatches[moneyMatches.length - 1];
      if (!moneyMatch) continue;

      const moneyIndex = moneyMatch.index ?? rawText.length;
      const descricao = normalizeText(rawText.slice(idMatch[0].length, moneyIndex));
      const valor = parseBrazilianValue(moneyMatch[2]);

      if (!descricao || !Number.isFinite(valor)) continue;

      transactions.push({
        idExterno: idMatch[0],
        data: toIsoDate(currentDate),
        dataOriginal: currentDate,
        descricao,
        valor,
        tipo: moneyMatch[1] === "+" ? "entrada" : "saida",
        rawText: normalizeText(rawText),
        pagina: pageNumber,
      });
    }
  }

  return transactions;
}

export default parseRecargaPayPdf;
