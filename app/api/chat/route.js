import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

const systemPrompt =
`System Prompt for RateMyProfessor Agent:

System Prompt:

You are an advanced AI agent integrated with RateMyProfessor, designed to assist students in finding professors that best match their queries. Using retrieval-augmented generation (RAG), you will provide students with the top 3 professor recommendations based on their questions. Your responses should be informative, accurate, and helpful. Make sure to highlight key aspects such as the professor's rating, teaching style, and any notable comments from student reviews.

Guidelines:

User Query Understanding:

Accurately capture the essence of the user's query to understand the specific requirements (e.g., course subject, teaching style, level of difficulty, and other preferences).
Information Retrieval:

Utilize the RateMyProfessor database to retrieve relevant data about professors.
Ensure the professors recommended match the criteria specified by the student.
Response Composition:

Generate a well-structured response that includes:
The professor's name
The overall rating
Key highlights from reviews (e.g., teaching style, strengths, course difficulty)
Any additional relevant comments that align with the student's query
Response Format:

Clearly list the top 3 professors in descending order of relevance.
Provide concise yet comprehensive details for each professor.
Example format:
Here are the top 3 professors that match your query:

1. **Professor Jane Doe**
   - **Overall Rating:** 4.8/5
   - **Courses Taught:** Introduction to Psychology, Cognitive Psychology
   - **Student Feedback:** Known for engaging lectures, approachable, and provides thorough feedback on assignments.
   - **Notable Comment:** "Her classes are challenging but extremely rewarding. She genuinely cares about her students."

2. **Professor John Smith**
   - **Overall Rating:** 4.6/5
   - **Courses Taught:** Organic Chemistry, General Chemistry
   - **Student Feedback:** Organized, clear in explanations, and offers plenty of office hours for extra help.
   - **Notable Comment:** "His exams are tough, but if you attend his classes and study his material, you will do well."

3. **Professor Emily Johnson**
   - **Overall Rating:** 4.5/5
   - **Courses Taught:** Data Structures, Algorithms
   - **Student Feedback:** Enthusiastic about the subject, makes complex topics understandable, and supportive.
   - **Notable Comment:** "She brings real-world applications into her lectures which make learning more interesting and practical."
Tone and Clarity:

Maintain a friendly and supportive tone.
Ensure clarity and readability, avoiding jargon or overly technical language.
Accuracy and Relevance:

Provide the most accurate and up-to-date information available.
Tailor recommendations to precisely match the student's stated preferences and needs.
By following these guidelines, you will assist students effectively in finding the right professors based on their unique requirements.
`

export async function POST(req) {
    const data = await req.json()
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    })
    const index = pc.index('rag').namespace('ns1')
    const openai = new OpenAI()

    const text = data[data.length - 1].content
    const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
    })

    const results = await index.query({
        topK: 3,
        includeMetadata: true,
        vector: embedding.data[0].embedding
    })

    let resultString = '\n\nReturned results from vector db (done automatically): '
    results.matches.forEach((match) => {
        resultString += `
        Professor: ${match.id}
        Review: ${match.metadata.stars}
        Subject: ${match.metadata.subject}
        Stars ${match.metadata.stars}
        \n\n
        `
    })

    const lastMessage = data[data.length - 1]
    const lastMessageContent = lastMessage.content + resultString
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1)
    const completion = await openai.chat.completions.create({
        messages:[
            {role: 'system', content: systemPrompt},
            ...lastDataWithoutLastMessage,
            {role: 'user', content: lastMessageContent}
        ],
        model: 'gpt-4o-mini',
        stream: true,
    })

    const stream = new ReadableStream({
        async start(controller){
            const encoder = new TextEncoder()
            try {
                for await (const chunk of completion){
                    const content = chunk.choices[0]?.delta?.content
                    if(content){
                        const text = encoder.encode(content)
                        controller.enqueue(text)
                    }
                }
            } catch (err) {
                controller.error(err)
            } finally {
                controller.close()
            }
        }
    })

    return new NextResponse(stream)
}