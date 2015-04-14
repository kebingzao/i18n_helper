/**
 * User: willerce
 * Date: 12/18/12
 * Time: 5:11 PM
 */


var fs = require('fs');
var config = require('./../global').config;
var needle = require('needle');
var _ = require('underscore');


exports.upload_all_translation = function (allLanglist) {

  var up = function (allLanglist, i) {
    var language = allLanglist[i].langcode.toString();
    console.log("开始上传,i=" + i + "语言是：" + language);
    if (language != 'en') {

      var buffer = fs.readFileSync('storage/build/csv/web_' + language + ".csv");
      var data = {
        language: language.replace(/_/, "-"),
        import_duplicates: 1,
        "files[web.csv]": {
          buffer: buffer,
          filename: language + '.csv',
          content_type: 'application/octet-stream'
        }
      };

      needle.post('http://api.crowdin.net/api/project/'
        + config.project_identifier + '/upload-translation?key=' + config.api_key,
        data,
        { multipart: true },
        function (err, resp, body) {
          console.log("上传文件" + language + '.csv完成，结果如下=========');
          if (!err) {
            console.log(body);
            i++;
            if (i < allLanglist.length) {
              up(allLanglist, i);
            }
          } else if (!body) {
            console.log(err);
            up(allLanglist, i);
          }
        }
      );
    } else {
      i++;
      if (i < allLanglist.length) {
        up(allLanglist, i);
      }
    }
  };

  up(allLanglist, 0);
};


/**
 * 上传翻译文件
 * @param language_code 语言code
 * @param csv_path  csv 路径
 * @param callback(language_code)
 */
exports.upload_translation = function(packageName,language_code, csv_path, callback) {
    var buffer = fs.readFileSync(csv_path);
    var data = {
        // 要上传翻译的语种
        language: language_code,
        // 如果该key已经存在翻译，是否覆盖，1 为覆盖，0 为不覆盖
        import_duplicates: 1
    };
    // 文件数组，key就是你要上传的crowdin已存在的文件名（库里面有保存）
    data["files[" + packageName + "]"] = {
        buffer: buffer,
        content_type: 'application/octet-stream'
    };
    needle.post('https://api.crowdin.com/api/project/'
            + config.project_identifier + '/upload-translation?key=' + config.api_key,
            data,
            { multipart: true },
            function (err, resp, body) {
                if (err) throw err;
                console.log("Got status code: " + resp.statusCode);
                console.log(body);
                console.log("上传文件" + language_code + '.csv完成');
                callback(language_code,resp.statusCode);
            }
    );
};

//生成最新的翻译文件
exports.export_api = function (callback) {
  needle.post('https://api.crowdin.com/api/project/' + config.project_identifier + '/export?key=' + config.api_key + '&json',
    {},
    function (err, resp, body) {
      if (err) {
        console.log(err);
        //export_api(callback);
      } else {
        console.log(body);
        callback(body);
      }
    }
  );
};

//下载最新的翻译文件
exports.download = function (name, callback) {
  needle.get('https://api.crowdin.com/api/project/' + config.project_identifier + '/download/all.zip?key=' + config.api_key,
    { output: name},
    function (err, resp, body) {
      if (!err) {
        callback(body);
      }
    });
};

//下载最新的翻译文件
exports.status = function (path, callback) {
  needle.post('http://api.crowdin.net/api/project/' + config.project_identifier + '/status?key=' + config.api_key,
    {json: ''},
    function (err, resp, body) {
      if (!err) throw  err;
      callback(body);
    });
};