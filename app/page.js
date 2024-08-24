'use client'
import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm the Rate My Professot support assistant. How can I help you today?"
    }
  ])
  const [message, setMessage] = useState('')
  const sendMessage = async () =>{
    setMessages=((messages)=>[
      ...messages,
      {role: "user", content: message},
      {role: "assistant", content: ''}
    ])
    setMessage('')

    const response = fetch
  }
  return (
    <></>
  );
}
