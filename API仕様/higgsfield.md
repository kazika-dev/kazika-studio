
Generates a video using the Kling 2.5 model with optional input image

Headers
hf-api-key
Type:Hf-Api-Key
Format:uuid
required
hf-secret
Type:Hf-Secret
required
Body
required
application/json
params
Type:object
required
Hide Child Attributesfor params
prompt
Type:string
min length:  
1
max length:  
1000
required
Example
Text prompt for video generation

cfg_scale
Type:number
min:  
0
max:  
1
multiple of:  
0.1
default: 
0.5
duration
Type:integer
enum
default: 
5
Example
Duration of the generated video in seconds

5
10
enhance_prompt
Type:boolean
default: 
false
Example
Whether to automatically enhance the prompt for better results

input_image
Type:object
Hide Child Attributesfor input_image
image_url
Type:Image Url
min length:  
1
max length:  
2083
Format:uri
required
type
const:  
image_url
required
negative_prompt
Type:string
default: 
""






import { request } from 'undici'

const { statusCode, body } = await request('https://platform.higgsfield.ai/generate/kling-2-5', {
  method: 'POST',
  headers: {
    'hf-api-key': '',
    'hf-secret': '',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    params: {
      model: 'kling-v2-5-turbo',
      prompt: 'A peaceful mountain landscape with flowing river',
      duration: 5,
      enhance_prompt: true
    }
  })
})





Successful Response
{
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "title": "Id"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "title": "Created At",
      "readOnly": true
    },
    "jobs": {
      "items": {
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "title": "Id"
          },
          "status": {
            "type": "string",
            "enum": [
              "queued",
              "in_progress",
              "completed",
              "failed",
              "nsfw"
            ],
            "title": "JobStatus"
          },
          "results": {
            "anyOf": [
              {
                "properties": {
                  "min": {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string"
                      },
                      "url": {
                        "type": "string"
                      }
                    },
                    "additionalProperties": false,
                    "description": "Optimized version of generated result"
                  },
                  "raw": {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string"
                      },
                      "url": {
                        "type": "string",
                        "format": "uri"
                      }
                    },
                    "additionalProperties": false,
                    "description": "Raw version without optimization"
                  }
                },
                "additionalProperties": false,
                "type": "object"
              },
              {
                "type": "null"
              }
            ],
            "title": "Results"
          }
        },
        "additionalProperties": false,
        "type": "object",
        "required": [
          "id",
          "results"
        ],
        "title": "Job"
      },
      "type": "array",
      "title": "Jobs"
    }
  },
  "additionalProperties": false,
  "type": "object",
  "required": [
    "id",
    "created_at",
    "jobs"
  ],
  "title": "JobSet"
}


Validation Error

{
  "properties": {
    "detail": {
      "items": {
        "properties": {
          "loc": {
            "items": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "integer"
                }
              ]
            },
            "type": "array",
            "title": "Location"
          },
          "msg": {
            "type": "string",
            "title": "Message"
          },
          "type": {
            "type": "string",
            "title": "Error Type"
          }
        },
        "type": "object",
        "required": [
          "loc",
          "msg",
          "type"
        ],
        "title": "ValidationError"
      },
      "type": "array",
      "title": "Detail"
    }
  },
  "type": "object",
  "title": "HTTPValidationError"
}