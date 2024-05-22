"use client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChangeEvent, useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import axios from "axios"
import { CSVLink, CSVDownload } from "react-csv"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts"
import Papa from "papaparse"
import { meanBy, groupBy } from "lodash"

export default function Home() {
  const [method, setMethod] = useState("")
  const [payload, setPayload] = useState("")
  const [textPrediction, setTextPrediction] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [filePrediction, setFilePrediction] = useState<any[]>([]) // Ensure initial state is an array
  const [processedData, setProcessedData] = useState<any[]>([]) // State for processed data

  const makeTextPredicition = async (text: string) => {
    try {
      const { data } = await axios.post("http://127.0.0.1:5000/predict", {
        text,
      })
      setTextPrediction(data.prediction)
    } catch (error) {
      alert(JSON.stringify(error))
    }
  }

  const makeBulkPredictionRequest = async (file: File) => {
    try {
      // Prepare form data
      const formData = new FormData()
      formData.append("file", file)

      const response = await axios.post(
        "http://127.0.0.1:5000/predict",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      )
      const parsedData = Papa.parse(response.data, {
        header: true,
        dynamicTyping: true,
      }).data

      setFilePrediction(parsedData)
    } catch (error) {
      console.error("Prediction request error:", error)
      throw error
    }
  }

  useEffect(() => {
    if (filePrediction.length > 0) {
      const processed = processFilePredictionData(filePrediction)
      setProcessedData(processed)
    }
  }, [filePrediction])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
    }
  }

  const processFilePredictionData = (data: any) => {
    // Group by 'categories'
    const groupedData = groupBy(data, "categories")

    // Process each group to calculate sentiment percentages
    const processedData = Object.keys(groupedData).map((key) => {
      const group = groupedData[key]
      const total = group.length

      // Count the occurrences of each sentiment
      const sentimentCounts = group.reduce(
        (acc, item) => {
          acc[item["Predicted sentiment"]] += 1
          return acc
        },
        { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 }
      )

      // Calculate percentages
      const sentimentPercentages = {
        category: key,
        positivePercentage: (sentimentCounts.POSITIVE / total) * 100,
        negativePercentage: (sentimentCounts.NEGATIVE / total) * 100,
        neutralPercentage: (sentimentCounts.NEUTRAL / total) * 100,
      }

      return sentimentPercentages
    })

    return processedData
  }

  console.log(processedData)

  return (
    <div className='p-4'>
      <div className='h-[45vh] w-full mb-6 bg-gradient-to-r from-teal-200 to-teal-500 flex items-center justify-center'>
        <div className=''>
          <h1 className='text-4xl font-bold text-white'>GROUP 1 NLP PROJECT</h1>
        </div>
      </div>

      {/* Choose either file or text */}
      <div>
        <Select onValueChange={(value) => setMethod(value)}>
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder='Choose predicition method' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='text'>Text</SelectItem>
            <SelectItem value='file'>File</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Show either text or file input according to chosen method */}

      {method == "text" && (
        <div className='grid w-full gap-2 mt-6'>
          <Textarea
            placeholder='Type your message here.'
            onChange={(e) => setPayload(e.target.value)}
          />
          <Button
            onClick={() => {
              if (payload) {
                makeTextPredicition(payload)
              } else {
                alert("Provide some text data to predict")
              }
            }}>
            Send message
          </Button>
        </div>
      )}

      {method == "file" && (
        <div className='grid w-full max-w-sm items-center gap-1.5 mt-6'>
          <Label htmlFor='picture'>Choose a csv file</Label>
          <Input id='picture' type='file' onChange={handleFileChange} />
          <Button
            onClick={() => {
              if (file) {
                makeBulkPredictionRequest(file)
              } else {
                alert("Provide a file to predict")
              }
            }}>
            Run predicition
          </Button>
        </div>
      )}

      {textPrediction && method === "text" && (
        <div>
          <div className='mt-6'>
            <div className='relative w-32 h-32 '>
              <div
                className={`absolute inset-0 ${
                  textPrediction === "NEGATIVE"
                    ? "bg-red-500"
                    : textPrediction === "POSITIVE"
                    ? "bg-green-500"
                    : "bg-orange-500"
                } rounded-full donut-shape`}>
                <p className='absolute text-center top-[39%] left-[20%] font-bold text-gray-600'>
                  {textPrediction}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {filePrediction && method === "file" && (
        <div className='mt-6'>
          {/* <CSVLink data={filePrediction}>Download me</CSVLink> */}
          <BarChart width={1200} height={300} data={processedData}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='category' />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey='positivePercentage' fill='#82ca9d' name='Positive' />
            <Bar dataKey='negativePercentage' fill='#8884d8' name='Negative' />
            <Bar dataKey='neutralPercentage' fill='#ffc658' name='Neutral' />
          </BarChart>
        </div>
      )}
    </div>
  )
}
