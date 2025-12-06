import '@/styles/text-gradient.css'

type TextGradientProps = {
    text: string
    from?: string
    via?: string
    to?: string
  }
  
  export default function TextGradient(props: TextGradientProps) {
    const from = props.from || 'from-orange-700'
    const via = props.via || 'via-blue-500'
    const to = props.to || 'to-green-400'
  
    return (
      <>{props.text}</>
    )
  }