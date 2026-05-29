"use client";

import { useState, useEffect } from "react";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

interface Props {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function parse(raw: string | undefined) {
  if (!raw) return { year: "", month: "", day: "" };
  // approximate: ~1920
  const clean = raw.startsWith("~") ? raw.slice(1) : raw;
  const approx = raw.startsWith("~");
  const parts = clean.split("-");
  return {
    year: (approx ? "~" : "") + (parts[0] ?? ""),
    month: parts[1] ?? "",
    day: parts[2] ?? "",
  };
}

function format(year: string, month: string, day: string): string {
  if (!year) return "";
  const approx = year.startsWith("~");
  const y = approx ? year.slice(1) : year;
  if (!y) return approx ? "~" : "";
  let result = approx ? "~" : "";
  result += y;
  if (month) {
    result += `-${month.padStart(2, "0")}`;
    if (day) result += `-${day.padStart(2, "0")}`;
  }
  return result;
}

export function DateInput({ value, onChange, placeholder = "Year" }: Props) {
  const parsed = parse(value);
  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);

  useEffect(() => {
    const p = parse(value);
    setYear(p.year);
    setMonth(p.month);
    setDay(p.day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function update(y: string, m: string, d: string) {
    onChange(format(y, m, d));
  }

  return (
    <div className="flex gap-1.5 items-center">
      <Input
        className="w-24 text-sm"
        placeholder={placeholder}
        value={year}
        onChange={(e) => { setYear(e.target.value); update(e.target.value, month, day); }}
      />
      <Select
        value={month || "__none__"}
        onValueChange={(v) => {
          const m = (v ?? "") === "__none__" ? "" : (v ?? "");
          setMonth(m);
          if (!m) setDay("");
          update(year, m, m ? day : "");
        }}
      >
        <SelectTrigger className="w-32 text-sm">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Month —</SelectItem>
          {MONTHS.map((name, i) => (
            <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {month && (
        <Select
          value={day || "__none__"}
          onValueChange={(v) => {
            const d = (v ?? "") === "__none__" ? "" : (v ?? "");
            setDay(d);
            update(year, month, d);
          }}
        >
          <SelectTrigger className="w-20 text-sm">
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Day —</SelectItem>
            {DAYS.map((d) => (
              <SelectItem key={d} value={String(d).padStart(2, "0")}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
