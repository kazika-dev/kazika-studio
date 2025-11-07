https://platform.higgsfield.ai
/v1/text2image/keyframes

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
Type:Prompt
required
aspect_ratio
Type:Aspect Ratio
enum
default: 
"3:4"
3:4
2:3
3:2
9:16
1:1
4:3
16:9
count
Type:Count
default: 
1
Number of output images

image_references
Type:array Image References[]
…8
Hide Child Attributesfor image_references
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
quality
Type:Quality
enum
default: 
"720p"
720p
1600p
seed
Type:Seed
min:  
1
max:  
1000000
nullable
Integer numbers.


import { request } from 'undici'

const { statusCode, body } = await request('https://platform.higgsfield.ai/v1/text2image/keyframes', {
  method: 'POST',
  headers: {
    'hf-api-key': '',
    'hf-secret': '',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    params: {
      seed: 1,
      count: 1,
      prompt: '',
      quality: '720p',
      aspect_ratio: '3:4',
      image_references: [
        {
          type: 'image_url',
          image_url: ''
        }
      ]
    }
  })
})


200
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



422
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