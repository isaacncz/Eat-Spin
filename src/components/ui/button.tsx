import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-brand-ink font-heading text-base font-semibold transition-all active:translate-y-[3px] active:shadow-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-pop hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-pop hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "bg-white text-brand-ink shadow-pop hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-arcade-cyan text-brand-ink shadow-pop hover:bg-arcade-cyan/80",
        ghost:
          "border-transparent active:translate-y-0 hover:bg-accent hover:text-accent-foreground",
        link: "border-transparent active:translate-y-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2 has-[>svg]:px-4",
        sm: "h-9 rounded-lg gap-1.5 px-3 text-sm has-[>svg]:px-2.5",
        lg: "h-12 rounded-xl px-6 text-lg has-[>svg]:px-5",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
