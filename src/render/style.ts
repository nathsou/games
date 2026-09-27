/** Rendering style knobs, set by the active design (see ui/design.ts). */
export interface RenderStyle {
  /** Rounded-edge width as a fraction of a face. */
  bevel: number;
  /** Edge line strength (0 = none, 1 = solid) and color. */
  edge: number;
  edgeColor: [number, number, number];
  /** Edge line width as a fraction of a face. */
  edgeWidth: number;
  /** 0 = soft shaded, 1 = flat (poster-like) lighting. */
  flat: number;
  /** Ambient occlusion strength (0..1). */
  ao: number;
  /** Specular sheen strength. */
  spec: number;
  /** Contact shadow strength multiplier. */
  shadow: number;
  /** Axis-colored bounding box / rails brightness multiplier. */
  lines: number;
  /** Hovered cube outline color and width (fraction of a face). */
  hoverColor: [number, number, number];
  hoverWidth: number;
}

export const renderStyle: RenderStyle = {
  bevel: 0.16,
  edge: 0.3,
  edgeColor: [0, 0, 0],
  edgeWidth: 0.022,
  flat: 0,
  ao: 1,
  spec: 1,
  shadow: 1,
  lines: 1,
  hoverColor: [0.17, 0.18, 0.26],
  hoverWidth: 0.05,
};
