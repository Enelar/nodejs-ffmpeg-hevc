const args = process.argv;

if (args.length < 3)
  return console.log('Target video file required');

let target_file = args[2];

const exec = require('child_process').exec;
function promised_exec(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      let obj = {
        error: error,
        stdout: stdout,
        stderr: stderr,
      };

      return resolve(obj);
    })
  })
}

function ParseVideo(obj) {
  var stream = obj.header.match(/video\:\s+(.*?),?\s.*?(\d+)x(\d+)/i);
  obj.codec = stream[1];
  obj.width = stream[2];
  obj.height = stream[3];

  return obj;
}

function ParseAudio(obj) {
  console.log(obj);

  var stream = obj.header.match(/audio\:\s+(.*?),?\s\d+\sHz,\s(.*?),.*?(\d+)\skb/i);
  obj.codec = stream[1];
  obj.mode = stream[2];

  return obj;
}

function AppendBitrate(obj) {
  for (var line of obj.meta) {
    if (!line.match(/bps\s+:/i))
      continue;

    var match = line.match(/(\d+)/);
    obj.bitrate = parseInt(match[1]);
  }

  for (var line of obj.meta) {
    if (!line.match(/NUMBER_OF_BYTES\s+:/i))
      continue;

    var match = line.match(/(\d+)/);
    obj.size = parseInt(match[1]);
  }

  return obj;
}


function ExtractStreams(file)
{
  return promised_exec('ffmpeg -i ' + file)
    .then((obj) => {
      let lines = obj.stderr.split("\n");
      let ret = [];

      var index = -1;

      for (let line of lines) {
        var stream_header = line.match(/stream.*?\#\d+\:(\d+)\(?(.*?)\)?\:\s+(.*?)\:/i)
        if (stream_header) {
          index++;
          ret[index] = {
            index: stream_header[1],
            name: stream_header[2],
            type: stream_header[3],
            header: line,
            meta: [],
          };

          continue;
        }

        if (typeof ret[index] != 'undefined')
          ret[index].meta.push(line);
      }

      return ret;
    })
    .then(function *(streams) {
      for (stream of streams) {
        if (stream.type.match(/video/i))
          yield ParseVideo(stream);
        else if (stream.type.match(/audio/i))
          yield ParseAudio(stream);
        else
          yield stream;
      }
    })
    .then(function *(streams) {
      for (stream of streams)
        yield AppendBitrate(stream)
    })
    .then((streams) => Array.from(streams))
}

ExtractStreams(target_file).then((streams) => {
  console.log(streams);
})
