import type { ComponentType, HTMLAttributes, PropsWithChildren } from "react";
import { createElement } from "react";

type MotionProps = HTMLAttributes<HTMLElement> & {
  [key: string]: unknown;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  layout?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
  whileInView?: unknown;
  viewport?: unknown;
  custom?: unknown;
  variants?: unknown;
};

const filteredProps = (props: MotionProps): HTMLAttributes<HTMLElement> => {
  const {
    initial,
    animate,
    exit,
    transition,
    layout,
    whileHover,
    whileTap,
    whileInView,
    viewport,
    custom,
    variants,
    ...rest
  } = props;
  void initial;
  void animate;
  void exit;
  void transition;
  void layout;
  void whileHover;
  void whileTap;
  void whileInView;
  void viewport;
  void custom;
  void variants;
  return rest;
};

const motionCache: Record<string, ComponentType<MotionProps>> = {};

const motionFactory = new Proxy(
  {},
  {
    get: (_target, key) => {
      const tag = String(key);
      if (!motionCache[tag]) {
        const MotionComponent: ComponentType<MotionProps> = (props) =>
          createElement(tag, filteredProps(props));
        motionCache[tag] = MotionComponent;
      }
      return motionCache[tag];
    },
  }
);

export const motion = motionFactory as Record<string, ComponentType<MotionProps>>;

export const AnimatePresence = ({ children }: PropsWithChildren) => <>{children}</>;
