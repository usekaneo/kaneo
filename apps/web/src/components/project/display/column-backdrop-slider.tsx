import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider, SliderValue } from "@/components/ui/slider";

type ColumnBackdropSliderProps = {
  label: string;
  resetLabel: string;
  value: number;
  defaultValue: number;
  max: number;
  step: number;
  format?: Intl.NumberFormatOptions;
  onChange: (value: number) => void;
};

export function ColumnBackdropSlider({
  label,
  resetLabel,
  value,
  defaultValue,
  max,
  step,
  format,
  onChange,
}: ColumnBackdropSliderProps) {
  return (
    <Slider
      value={value}
      min={0}
      max={max}
      step={step}
      format={format}
      onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      className="flex flex-col *:data-[slot=slider-control]:py-2"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <SliderPrimitive.Label className="text-sm">
            {label}
          </SliderPrimitive.Label>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={resetLabel}
            title={resetLabel}
            disabled={value === defaultValue}
            onClick={() => onChange(defaultValue)}
            className="text-muted-foreground disabled:opacity-40"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
        <SliderValue className="text-muted-foreground text-xs tabular-nums" />
      </div>
    </Slider>
  );
}
