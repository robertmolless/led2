import { useEffect, useMemo } from "react";
import type { ProjectResult, ProjectConfig, ProcessorRecommendation, PatchPlan } from "../types";
import { buildSchemeSvg } from "../utils/svgBuilder";

interface Props {
  config: ProjectConfig;
  result: ProjectResult;
  recommendation?: ProcessorRecommendation;
  patchPlan?: PatchPlan;
  /** Колбэк для передачи готового SVG родителю (для экспорта). */
  onSvgReady?: (svg: string) => void;
}

export function SchemeSvg({ config, result, recommendation, patchPlan, onSvgReady }: Props) {
  const svg = useMemo(
    () => buildSchemeSvg({ config, result, recommendation, patchPlan }),
    [config, result, recommendation, patchPlan]
  );

  useEffect(() => {
    onSvgReady?.(svg);
  }, [svg, onSvgReady]);

  return (
    <div className="scheme-wrapper">
      <div
        className="scheme-svg"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
