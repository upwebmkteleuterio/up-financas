import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// Permite apenas a tag <u> além do conjunto padrão do GitHub, para dar suporte
// a sublinhado sem abrir brechas de HTML arbitrário (o conteúdo é sanitizado).
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u"],
};

interface MarkdownMessageProps {
  content: string;
}

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => (
  <div className="space-y-2 break-words">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
      components={{
        h1: ({ children }) => <h3 className="mt-3 text-base font-semibold text-white first:mt-0">{children}</h3>,
        h2: ({ children }) => <h4 className="mt-3 text-sm font-semibold text-white first:mt-0">{children}</h4>,
        h3: ({ children }) => <h5 className="mt-3 text-sm font-semibold text-white first:mt-0">{children}</h5>,
        h4: ({ children }) => <h6 className="mt-2 text-sm font-semibold text-white first:mt-0">{children}</h6>,
        h5: ({ children }) => <h6 className="mt-2 text-sm font-semibold text-white first:mt-0">{children}</h6>,
        h6: ({ children }) => <h6 className="mt-2 text-sm font-semibold text-white first:mt-0">{children}</h6>,
        p: ({ children }) => <p className="my-1 leading-6 first:mt-0 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        u: ({ children }) => <u className="underline decoration-emerald-300/70 underline-offset-2">{children}</u>,
        ul: ({ children }) => <ul className="my-1 list-disc space-y-1 pl-5 marker:text-emerald-300/80">{children}</ul>,
        ol: ({ children }) => <ol className="my-1 list-decimal space-y-1 pl-5 marker:text-emerald-300/80">{children}</ol>,
        li: ({ children }) => <li className="leading-6">{children}</li>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-emerald-300/40 pl-3 text-slate-300">{children}</blockquote>
        ),
        code: ({ className, children }) => (
          className
            ? <code className="font-mono text-xs text-emerald-200">{children}</code>
            : <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.85em] text-emerald-200">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-xs">{children}</pre>
        ),
        hr: () => <hr className="my-3 border-white/10" />,
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-white/10 bg-white/5 px-2 py-1 text-left font-semibold text-white">{children}</th>
        ),
        td: ({ children }) => <td className="border-b border-white/5 px-2 py-1 align-top">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

export default MarkdownMessage;
