"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/*
 * Every object passed to <Sonner> is built once, at module scope.
 *
 * This is not a micro-optimisation. Sonner keeps these props in effects whose
 * dependency arrays compare by identity, so an object literal written inline
 * in the component body is a new dependency on every render: the effect
 * re-runs, sets state, triggers a render, and builds a new object again.
 * React stops that at its nesting limit and reports
 * "Maximum update depth exceeded" from Toaster.useEffect — an error that names
 * sonner and RootLayout and gives no hint that the cause is an inline literal.
 *
 * Hoisting them makes the identities constant for the lifetime of the module,
 * so each effect runs once. `theme` is still read per render, because it
 * genuinely changes, but it is a string and compares by value.
 */
const ICONS = {
  success: <CircleCheckIcon className="size-4" />,
  info: <InfoIcon className="size-4" />,
  warning: <TriangleAlertIcon className="size-4" />,
  error: <OctagonXIcon className="size-4" />,
  loading: <Loader2Icon className="size-4 animate-spin" />,
} as const

const STYLE = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "var(--radius)",
} as React.CSSProperties

const TOAST_OPTIONS = {
  classNames: {
    toast: "cn-toast",
  },
} as const

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={ICONS}
      style={STYLE}
      toastOptions={TOAST_OPTIONS}
      {...props}
    />
  )
}

export { Toaster }
