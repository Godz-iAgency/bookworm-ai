"use client"
import { memo, type ReactNode, useState, type ChangeEvent, type FormEvent, useEffect, useRef, forwardRef } from "react"
import type React from "react"

import Image from "next/image"
import { motion, useAnimation, useInView, useMotionTemplate, useMotionValue } from "motion/react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

// ==================== Input Component ====================

const Input = memo(
  forwardRef(function Input(
    { className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>,
    ref: React.ForwardedRef<HTMLInputElement>,
  ) {
    const radius = 100
    const [visible, setVisible] = useState(false)

    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)

    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent<HTMLDivElement>) {
      const { left, top } = currentTarget.getBoundingClientRect()

      mouseX.set(clientX - left)
      mouseY.set(clientY - top)
    }

    return (
      <motion.div
        style={{
          background: useMotionTemplate`
        radial-gradient(
          ${visible ? radius + "px" : "0px"} circle at ${mouseX}px ${mouseY}px,
          #06b6d4,
          transparent 80%
        )
      `,
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="group/input rounded-lg p-[2px] transition duration-300"
      >
        <input
          type={type}
          className={cn(
            `flex h-10 w-full rounded-md border-none bg-[hsl(219,63%,16%)] px-3 py-2 text-sm text-white transition duration-400 group-hover/input:shadow-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:ring-[2px] focus-visible:ring-cyan-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 shadow-[0px_0px_1px_1px_hsl(217,32.6%,17.5%)]`,
            className,
          )}
          ref={ref}
          {...props}
        />
      </motion.div>
    )
  }),
)

Input.displayName = "Input"

// ==================== BoxReveal Component ====================

type BoxRevealProps = {
  children: ReactNode
  width?: string
  boxColor?: string
  duration?: number
  overflow?: string
  position?: string
  className?: string
}

const BoxReveal = memo(function BoxReveal({
  children,
  width = "fit-content",
  boxColor,
  duration,
  overflow = "hidden",
  position = "relative",
  className,
}: BoxRevealProps) {
  const mainControls = useAnimation()
  const slideControls = useAnimation()
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (isInView) {
      slideControls.start("visible")
      mainControls.start("visible")
    } else {
      slideControls.start("hidden")
      mainControls.start("hidden")
    }
  }, [isInView, mainControls, slideControls])

  return (
    <section
      ref={ref}
      style={{
        position: position as "relative" | "absolute" | "fixed" | "sticky" | "static",
        width,
        overflow,
      }}
      className={className}
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 75 },
          visible: { opacity: 1, y: 0 },
        }}
        initial="hidden"
        animate={mainControls}
        transition={{ duration: duration ?? 0.5, delay: 0.25 }}
      >
        {children}
      </motion.div>
      <motion.div
        variants={{ hidden: { left: 0 }, visible: { left: "100%" } }}
        initial="hidden"
        animate={slideControls}
        transition={{ duration: duration ?? 0.5, ease: "easeIn" }}
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: 0,
          right: 0,
          zIndex: 20,
          background: boxColor ?? "#1e3a5f",
          borderRadius: 4,
        }}
      />
    </section>
  )
})

// ==================== Ripple Component ====================

type RippleProps = {
  mainCircleSize?: number
  mainCircleOpacity?: number
  numCircles?: number
  className?: string
}

export const Ripple = memo(function Ripple({
  mainCircleSize = 210,
  mainCircleOpacity = 0.24,
  numCircles = 11,
  className = "",
}: RippleProps) {
  return (
    <section
      className={`max-w-[50%] absolute inset-0 flex items-center justify-center
        bg-[hsl(222,94%,5%)]
        [mask-image:linear-gradient(to_bottom,black,transparent)] ${className}`}
    >
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * 70
        const opacity = mainCircleOpacity - i * 0.03
        const animationDelay = `${i * 0.06}s`
        const borderStyle = i === numCircles - 1 ? "dashed" : "solid"

        return (
          <span
            key={i}
            className="absolute animate-ripple rounded-full bg-blue-500/10 border border-blue-400/20"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              opacity: opacity,
              animationDelay: animationDelay,
              borderStyle: borderStyle,
              borderWidth: "1px",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        )
      })}
    </section>
  )
})

// ==================== OrbitingCircles Component ====================

type OrbitingCirclesProps = {
  className?: string
  children: ReactNode
  reverse?: boolean
  duration?: number
  delay?: number
  radius?: number
  path?: boolean
}

const OrbitingCircles = memo(function OrbitingCircles({
  className,
  children,
  reverse = false,
  duration = 20,
  delay = 10,
  radius = 50,
  path = true,
}: OrbitingCirclesProps) {
  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <circle className="stroke-blue-400/20 stroke-1" cx="50%" cy="50%" r={radius} fill="none" />
        </svg>
      )}
      <section
        style={
          {
            "--duration": duration,
            "--radius": radius,
            "--delay": -delay,
          } as React.CSSProperties
        }
        className={cn(
          "absolute flex size-full transform-gpu animate-orbit items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/5 [animation-delay:calc(var(--delay)*1000ms)]",
          { "[animation-direction:reverse]": reverse },
          className,
        )}
      >
        {children}
      </section>
    </>
  )
})

// ==================== TechOrbitDisplay Component ====================

type IconConfig = {
  className?: string
  duration?: number
  delay?: number
  radius?: number
  path?: boolean
  reverse?: boolean
  component: () => React.ReactNode
}

type TechnologyOrbitDisplayProps = {
  iconsArray: IconConfig[]
  text?: string
}

export const TechOrbitDisplay = memo(function TechOrbitDisplay({
  iconsArray,
  text = "Animated Login",
}: TechnologyOrbitDisplayProps) {
  return (
    <section className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-lg">
      <span className="pointer-events-none whitespace-pre-wrap bg-gradient-to-b from-cyan-400 to-white/80 bg-clip-text text-center text-7xl font-semibold leading-none text-transparent">
        {text}
      </span>

      {iconsArray.map((icon, index) => (
        <OrbitingCircles
          key={index}
          className={icon.className}
          duration={icon.duration}
          delay={icon.delay}
          radius={icon.radius}
          path={icon.path}
          reverse={icon.reverse}
        >
          {icon.component()}
        </OrbitingCircles>
      ))}
    </section>
  )
})

// ==================== AnimatedForm Component ====================

type FieldType = "text" | "email" | "password"

type Field = {
  label: string
  required?: boolean
  type: FieldType
  placeholder?: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

type AnimatedFormProps = {
  header: string
  subHeader?: string
  fields: Field[]
  submitButton: string
  textVariantButton?: string
  errorField?: string
  fieldPerRow?: number
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  googleLogin?: string
  goTo?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

type Errors = {
  [key: string]: string
}

const AnimatedForm = memo(function AnimatedForm({
  header,
  subHeader,
  fields,
  submitButton,
  textVariantButton,
  errorField,
  fieldPerRow = 1,
  onSubmit,
  googleLogin,
  goTo,
}: AnimatedFormProps) {
  const [visible, setVisible] = useState<boolean>(false)
  const [errors, setErrors] = useState<Errors>({})

  const toggleVisibility = () => setVisible(!visible)

  const validateForm = (event: FormEvent<HTMLFormElement>) => {
    const currentErrors: Errors = {}
    fields.forEach((field) => {
      const value = (event.target as HTMLFormElement)[field.label]?.value

      if (field.required && !value) {
        currentErrors[field.label] = `${field.label} is required`
      }

      if (field.type === "email" && value && !/\S+@\S+\.\S+/.test(value)) {
        currentErrors[field.label] = "Invalid email address"
      }

      if (field.type === "password" && value && value.length < 6) {
        currentErrors[field.label] = "Password must be at least 6 characters long"
      }
    })
    return currentErrors
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formErrors = validateForm(event)

    if (Object.keys(formErrors).length === 0) {
      onSubmit(event)
      console.log("Form submitted")
    } else {
      setErrors(formErrors)
    }
  }

  return (
    <section className="max-md:w-full flex flex-col gap-4 w-96 mx-auto">
      <BoxReveal boxColor="#1e3a5f" duration={0.3}>
        <h2 className="font-bold text-3xl text-white">{header}</h2>
      </BoxReveal>

      {subHeader && (
        <BoxReveal boxColor="#1e3a5f" duration={0.3} className="pb-2">
          <p className="text-gray-300 text-sm max-w-sm">{subHeader}</p>
        </BoxReveal>
      )}

      {googleLogin && (
        <>
          <BoxReveal boxColor="#1e3a5f" duration={0.3} overflow="visible" width="unset">
            <button
              className="group/btn bg-[hsl(219,63%,16%)] w-full rounded-lg border border-[hsl(217,32.6%,17.5%)] h-10 font-medium outline-hidden hover:cursor-pointer hover:bg-[hsl(219,63%,18%)] transition-colors text-white"
              type="button"
              onClick={() => console.log("Google login clicked")}
            >
              <span className="flex items-center justify-center w-full h-full gap-3">
                <Image
                  src="https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-09-512.png"
                  width={26}
                  height={26}
                  alt="Google Icon"
                />
                {googleLogin}
              </span>

              <BottomGradient />
            </button>
          </BoxReveal>

          <BoxReveal boxColor="#1e3a5f" duration={0.3} width="100%">
            <section className="flex items-center gap-4">
              <hr className="flex-1 border-1 border-dashed border-gray-600" />
              <p className="text-gray-400 text-sm">or</p>
              <hr className="flex-1 border-1 border-dashed border-gray-600" />
            </section>
          </BoxReveal>
        </>
      )}

      <form onSubmit={handleSubmit}>
        <section className={`grid grid-cols-1 md:grid-cols-${fieldPerRow} mb-4`}>
          {fields.map((field) => (
            <section key={field.label} className="flex flex-col gap-2">
              <BoxReveal boxColor="#1e3a5f" duration={0.3}>
                <Label htmlFor={field.label} className="text-gray-200">
                  {field.label} <span className="text-red-400">*</span>
                </Label>
              </BoxReveal>

              <BoxReveal width="100%" boxColor="#1e3a5f" duration={0.3} className="flex flex-col space-y-2 w-full">
                <section className="relative">
                  <Input
                    type={field.type === "password" ? (visible ? "text" : "password") : field.type}
                    id={field.label}
                    placeholder={field.placeholder}
                    onChange={field.onChange}
                  />

                  {field.type === "password" && (
                    <button
                      type="button"
                      onClick={toggleVisibility}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-400"
                    >
                      {visible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                    </button>
                  )}
                </section>

                <section className="h-4">
                  {errors[field.label] && <p className="text-red-400 text-xs">{errors[field.label]}</p>}
                </section>
              </BoxReveal>
            </section>
          ))}
        </section>

        <BoxReveal width="100%" boxColor="#1e3a5f" duration={0.3}>
          {errorField && <p className="text-red-400 text-sm mb-4">{errorField}</p>}
        </BoxReveal>

        <BoxReveal width="100%" boxColor="#1e3a5f" duration={0.3} overflow="visible">
          <button
            className="bg-gradient-to-r from-cyan-500 to-blue-500 relative group/btn
            block w-full text-white rounded-md h-10 font-medium shadow-lg hover:shadow-cyan-500/50 transition-all outline-hidden hover:cursor-pointer"
            type="submit"
          >
            {submitButton} &rarr;
            <BottomGradient />
          </button>
        </BoxReveal>

        {textVariantButton && goTo && (
          <BoxReveal boxColor="#1e3a5f" duration={0.3}>
            <section className="mt-4 text-center hover:cursor-pointer">
              <button
                className="text-sm text-cyan-400 hover:text-cyan-300 hover:cursor-pointer outline-hidden transition-colors"
                onClick={goTo}
              >
                {textVariantButton}
              </button>
            </section>
          </BoxReveal>
        )}
      </form>
    </section>
  )
})

const BottomGradient = () => {
  return (
    <>
      <span className="group-hover/btn:opacity-100 block transition duration-500 opacity-0 absolute h-px w-full -bottom-px inset-x-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
      <span className="group-hover/btn:opacity-100 blur-sm block transition duration-500 opacity-0 absolute h-px w-1/2 mx-auto -bottom-px inset-x-10 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
    </>
  )
}

// ==================== AuthTabs Component ====================

interface AuthTabsProps {
  formFields: {
    header: string
    subHeader?: string
    fields: Array<{
      label: string
      required?: boolean
      type: string
      placeholder: string
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
    }>
    submitButton: string
    textVariantButton?: string
  }
  goTo: (event: React.MouseEvent<HTMLButtonElement>) => void
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export const AuthTabs = memo(function AuthTabs({ formFields, goTo, handleSubmit }: AuthTabsProps) {
  return (
    <div className="flex max-lg:justify-center w-full md:w-auto">
      <div className="w-full lg:w-1/2 h-[100dvh] flex flex-col justify-center items-center max-lg:px-[10%]">
        <AnimatedForm
          {...formFields}
          fieldPerRow={1}
          onSubmit={handleSubmit}
          goTo={goTo}
          googleLogin="Login with Google"
        />
      </div>
    </div>
  )
})

// ==================== Label Component ====================

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  htmlFor?: string
}

const Label = memo(function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  )
})

// ==================== Exports ====================

export { Input, BoxReveal, OrbitingCircles, AnimatedForm, Label, BottomGradient }
