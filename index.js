process.env.PATH = process.env.PATH + ':' + process.env['LAMBDA_TASK_ROOT'];

const AWS = require('aws-sdk');
const { spawn, spawnSync } = require('child_process');
const { createReadStream, createWriteStream } = require('fs');
const axios = require('axios');

const s3 = new AWS.S3();
const ffprobePath = '/opt/ffprobe';
const ffmpegPath = '/opt/ffmpeg';
const allowedTypes = ['mov', 'mpg', 'mpeg', 'mp4', 'wmv', 'avi', 'webm'];
const destBucketCFURL = 'https://test.cloudfront.net';
const serverEndpoint = 'https://dev.server.com';

module.exports.handler = async (event, context) => {
  console.log('event: ', JSON.stringify(event));
  console.log('context:', JSON.stringify(context));
  const srcKey = decodeURIComponent(event.Records[0].s3.object.key).replace(
    /\+/g,
    ' '
  );
  const bucket = event.Records[0].s3.bucket.name;
  const target = s3.getSignedUrl('getObject', {
    Bucket: bucket,
    Key: srcKey,
    Expires: 3600,
  });
  let fileType = srcKey.match(/\.\w+$/);

  if (!fileType) {
    throw new Error(`invalid file type found for key: ${srcKey}`);
  }

  fileType = fileType[0].slice(1);

  if (allowedTypes.indexOf(fileType) === -1) {
    throw new Error(`filetype: ${fileType} is not an allowed type`);
  }

  // async function changeVideoToMp4() {
  //   const result = await spawn(ffmpegPath, [
  //       '-i',
  //       target,
  //       '-qscale',
  //       '0',
  //       '/tmp/video.mp4',
  //     ])
  //     return 0;
  // }

  function createImage(seek) {
    console.log('Create Thumbnail Image - Start');
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        '-i',
        target,
        '-vframes',
        '1',
        '/tmp/output.png',
      ]);

      ffmpeg.on('close', function (code) {
        console.log('Generate Thumbnail Clear!');
        resolve();
      });

      ffmpeg.on('error', function (err) {
        console.log('Generate Thumbnail Error!');
        console.log(err);
        reject();
      });
    });
  }

  function uploadToS3(x) {
    console.log('UPLOAD IMAGE TO S3 - Start');
    return new Promise((resolve, reject) => {
      let tmpFile = createReadStream(`/tmp/output.png`);
      let dstKey = srcKey.replace(/\.\w+$/, `-${x}-thumb.png`);

      var params = {
        Bucket: bucket,
        Key: dstKey,
        Body: tmpFile,
        ContentType: `image/png`,
      };

      s3.upload(params, function (err, data) {
        if (err) {
          console.log('UPLOAD IMAGE TO S3 - Error', error);
          reject();
        }
        console.log(
          `    console.log('UPLOAD IMAGE TO S3 - Success ${bucket}/${dstKey}`
        );
        resolve();
      });
    });
  }

  // function uploadConvertedVideoToS3(x) {
  //   console.log("UPLOAD VIDEO TO S3 START!")
  //   return new Promise((resolve, reject) => {
  //     let tmpFile = createReadStream(`/tmp/video.mp4`)
  //     let dstKey = srcKey.replace(/\.\w+$/, `-${x}-changed.mp4`)

  //     var params = {
  //       Bucket: bucket,
  //       Key: dstKey,
  //       Body: tmpFile,
  //       ContentType: `video/mp4`
  //     }

  //     s3.upload(params, function(err, data) {
  //       if (err) {
  //         console.log('VIDEO S3 UPLOAD ERROR: ', err)
  //         reject()
  //       }
  //       console.log(`successful upload VIDEO to ${bucket}/${dstKey}`)
  //       resolve()
  //     })
  //   })
  // }

  function updateThumbnailUrlToDatabase() {
    console.log('update call');
    const fileName = srcKey.split('.')[0];

    const options = {
      method: 'POST',
      url: `${serverEndpoint}/attachments/video/thumbnail`,
      headers: { 'Content-Type': 'application/json' },
      data: {
        origin_url: `${destBucketCFURL}/${srcKey}`,
        thumbnail_url: `${destBucketCFURL}/${fileName}-1-thumb.png`,
        // video_url: `${destBucketCFURL}/${fileName}-1-changed.mp4`
        video_url: `${destBucketCFURL}/${srcKey}`,
      },
    };
    return new Promise((resolve, reject) => {
      axios
        .request(options)
        .then(function (response) {
          console.log(response.data);
          resolve();
        })
        .catch(function (error) {
          console.error(error);
          reject();
        });

      axios
        .request(options)
        .then(function (response) {
          console.log(response.data);
        })
        .catch(function (error) {
          console.error(error);
        });
      return 0;
    });
  }

  const ffprobe = spawnSync(ffprobePath, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nw=1:nk=1',
    target,
  ]);

  console.log('S3 Signed URL: ', target);
  if (!srcKey.includes('-changed.mp4')) { //changed video is not lambdas target 
    const duration = Math.ceil(ffprobe.stdout.toString()) * 0.5;
    console.log('duration: ', duration);

    // enable if you want change video to mp4 
    // const changeVideoResult = await changeVideoToMp4()
    // const s3VideoUploadResult = await uploadConvertedVideoToS3(1)

    const createImageResult = await createImage(duration);
    const s3UploadResult = await uploadToS3(1);

    //enable if you want external server call
    //const update = await updateThumbnailUrlToDatabase();
    return console.log(`processed ${bucket}/${srcKey} successfully`);
  } else {
    return 0;
  }
};
