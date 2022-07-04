# Lambda-Video-Thumbnail-Generator

## Environment
Tested At AWS Lambda + Node 12.x 

## Setup (Layer)
1. Upload Lambda Layer axios (axios.zip)
2. Upload Lambda Layer ffmpeg (ffmpeg.zip)
https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html

## Extension Feature
1. if you want call external server to update thumbnail image url, enable 
`const update = await updateThumbnailUrlToDatabase();` 

2. if you want change video to mp4, enable
```    
    // const changeVideoResult = await changeVideoToMp4()
    // const s3VideoUploadResult = await uploadConvertedVideoToS3(1)
```

## recommand setup
* set lambda trigger as s3, with prefix (as specific folder ex) `origin-video/*` ) and postfix (video extension, is not support multiple extension type)
* set lambda handler as index.js

## Author 
@cokia (hanu@a-fin.co.kr)