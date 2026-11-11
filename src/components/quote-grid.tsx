"use client";
import { date, money } from "@/lib/format";
import { quoteProblems } from "@/lib/quote-rules";
import type { PurchaseRequest, Quote } from "@/lib/types";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo } from "react";
ModuleRegistry.registerModules([AllCommunityModule]);
const theme = themeQuartz.withParams({
  accentColor: "#0066f5",
  backgroundColor: "#ffffff",
  foregroundColor: "#10254e",
  borderColor: "#dce5f3",
  headerBackgroundColor: "#f5f8ff",
  fontFamily: "Inter Variable, sans-serif",
  fontSize: 14,
  rowHeight: 72,
  headerHeight: 44,
  wrapperBorderRadius: 0,
  cellHorizontalPadding: 18,
});
export default function QuoteGrid({
  quotes,
  request,
  onEvidence,
}: {
  quotes: Quote[];
  request: PurchaseRequest;
  onEvidence: (q: Quote) => void;
}) {
  const columns = useMemo<ColDef<Quote>[]>(
    () => [
      {
        headerName: "Supplier",
        field: "company",
        pinned: "left",
        minWidth: 200,
        flex: 1.5,
        cellRenderer: ({ data: q }: { data: Quote }) => (
          <div className="grid-supplier">
            <strong>{q.company}</strong>
            <small>
              {q.relationship} · Written v{q.version}
            </small>
          </div>
        ),
      },
      {
        headerName: "Unit price",
        field: "unit_price",
        minWidth: 110,
        valueFormatter: (p) => money(p.value, p.data?.currency),
      },
      {
        headerName: "Shipping",
        field: "shipping",
        minWidth: 115,
        valueFormatter: (p) =>
          p.value === null ? "Unknown" : money(p.value, p.data?.currency),
        cellClass: (p) => (p.value === null ? "grid-warning" : ""),
      },
      {
        headerName: "Tax",
        field: "tax",
        minWidth: 110,
        valueFormatter: (p) =>
          p.value === null ? "Unknown" : money(p.value, p.data?.currency),
        cellClass: (p) => (p.value === null ? "grid-warning" : ""),
      },
      {
        headerName: "Total",
        field: "total",
        minWidth: 130,
        valueFormatter: (p) =>
          p.value === null ? "Incomplete" : money(p.value, p.data?.currency),
        cellClass: "grid-money",
      },
      {
        headerName: "Delivery",
        field: "completion_date",
        minWidth: 130,
        valueFormatter: (p) => date(p.value),
        cellRenderer: ({ data: q }: { data: Quote }) => (
          <div className="grid-delivery">
            <span>{date(q.completion_date)}</span>
            <small
              className={
                q.completion_date > request.spec.deadline
                  ? "text-amber"
                  : "text-green"
              }
            >
              {q.completion_date > request.spec.deadline
                ? "After deadline"
                : "Within deadline"}
            </small>
          </div>
        ),
      },
      {
        headerName: "Completeness",
        colId: "completeness",
        minWidth: 160,
        valueGetter: (p) =>
          p.data ? quoteProblems(p.data, request).length : 0,
        cellRenderer: ({ data: q }: { data: Quote }) => {
          const n = quoteProblems(q, request).length;
          return (
            <span className={`grid-fit ${n ? "grid-fit-review" : ""}`}>
              <span />
              {n
                ? `${n} ${n === 1 ? "issue" : "issues"} to review`
                : "Meets requirements"}
            </span>
          );
        },
      },
      {
        headerName: "Evidence",
        colId: "evidence",
        minWidth: 120,
        sortable: false,
        filter: false,
        cellRenderer: ({ data: q }: { data: Quote }) => (
          <button className="grid-evidence" onClick={() => onEvidence(q)}>
            View details ↗
          </button>
        ),
      },
    ],
    [request, onEvidence],
  );
  return (
    <div className="quote-grid" aria-label="Supplier quotation comparison">
      <AgGridReact
        theme={theme}
        rowData={quotes}
        columnDefs={columns}
        defaultColDef={{
          sortable: true,
          filter: true,
          resizable: true,
          width: 120,
        }}
        getRowId={(p) => p.data.id}
        domLayout="normal"
        suppressCellFocus={false}
        tooltipShowDelay={200}
      />
    </div>
  );
}
