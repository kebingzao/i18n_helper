/**
 * User: willerce
 * Date: 12/17/12
 * Time: 6:24 PM
 */

var util = require('util');
var _ = require('underscore');
var fs = require('fs');
var archiver = require('archiver');
var xml = require('xml');
_.str = require('underscore.string');
var airRmdir = require('rimraf');
// 数据库
var db = require("../global").database;
// 绑定 collection 表
// 所有项目的project 集合
db.bind("project_list");

// 获取对应的集合
function getCollection(collectionName){
    if(!db[collectionName]){
        db.bind(collectionName);
    }
    return db[collectionName];
}

// 获取该项目的语言列表集合
function getCollectionList(collectionName){
    return getCollection(collectionName + "_list");
}

// 获取该项目的语言内容集合
function getCollectionLang(collectionName){
    return getCollection(collectionName + "_lang");
}

// 清空某一个文件夹
exports.clearDir = function(path,callback){
    fs.readdir(path, function(err, files){
        //err 为错误 , files 文件名列表包含文件夹与文件
        if(err){
            console.log('error:\n' + err);
            return;
        }
        var count = files.length;
        files.forEach(function(file,index){
            var filePath = path + '/' + file;
            fs.stat(filePath, function(err, stat){
                if(err){console.log(err); return;}
                if(stat.isDirectory()){
                    // 如果是文件夹
                    airRmdir(filePath,function(err){
                        if(!err){
                            console.log("删除目录成功");
                            // 判断是否是最后一个
                            if(index == count - 1){
                                _.isFunction(callback) && callback();
                            }
                        }else{
                            console.log("删除目录失败");
                        }
                    })
                }else{
                    // 读出所有的文件
                    // 如果是文件，就删除;
                    fs.unlink(filePath, function (err) {
                        if (err) {
                            // 出错
                            console.log("删除文件出错");
                        }
                        // 判断是否是最后一个
                        if(index == count - 1){
                            _.isFunction(callback) && callback();
                        }
                    });
                }
            });
        });
    });
};

// 获取总的可用语言列表
exports.getAllLangList = function(){
    return [
        {"name":"阿拉伯语","langcode":"ar","folder":"ar"},
        {"name":"保加利亚语","langcode":"bg","folder":"bg"},
        {"name":"加泰罗尼亚语","langcode":"ca","folder":"ca"},
        {"name":"捷克语","langcode":"cs","folder":"cs"},
        {"name":"丹麦语","langcode":"da","folder":"da"},
        {"name":"德语","langcode":"de","folder":"de"},
        {"name":"希腊语","langcode":"el","folder":"el"},
        {"name":"英语","langcode":"en","folder":"en"},
        {"name":"西班牙语","langcode":"es_es","folder":"es-ES"},
        {"name":"芬兰语【Finnish】","langcode":"fi","folder":"fi"},
        {"name":"法语","langcode":"fr","folder":"fr"},
        {"name":"印度","langcode":"hi","folder":"hi"},
        {"name":"克罗地亚语","langcode":"hr","folder":"hr"},
        {"name":"匈牙利语","langcode":"hu","folder":"hu"},
        {"name":"印尼语","langcode":"id","folder":"id"},
        {"name":"意大利语","langcode":"it","folder":"it"},
        {"name":"日语","langcode":"ja","folder":"ja"},
        {"name":"朝鲜语","langcode":"ko","folder":"ko"},
        {"name":"马来语","langcode":"ms","folder":"ms"},
        {"name":"荷兰","langcode":"nl","folder":"nl"},
        {"name":"挪威语","langcode":"no","folder":"no"},
        {"name":"波兰语","langcode":"pl","folder":"pl"},
        {"name":"巴西葡萄牙语","langcode":"pt_br","folder":"pt-BR"},
        {"name":"葡萄牙语","langcode":"pt_pt","folder":"pt-PT"},
        {"name":"罗马尼亚语","langcode":"ro","folder":"ro"},
        {"name":"俄语","langcode":"ru","folder":"ru"},
        {"name":"斯洛伐克语","langcode":"sk","folder":"sk"},
        {"name":"塞尔维亚语","langcode":"sr","folder":"sr"},
        {"name":"瑞典","langcode":"sv-se","folder":"sv-SE"},
        {"name":"土耳其语","langcode":"tr","folder":"tr"},
        {"name":"乌克兰语","langcode":"uk","folder":"uk"},
        {"name":"越南语","langcode":"vi","folder":"vi"},
        {"name":"简体中文","langcode":"zh-cn","folder":"zh-CN"},
        {"name":"繁体中文","langcode":"zh-tw","folder":"zh-TW"}
    ];
};

/**
 * Returns array of file names from specified directory
 *
 * @param {dir} directory of source files.
 * return {array}
 */
var getDirectoryList = function(dir){
    var fileArray = [],
            files = fs.readdirSync(dir);
    files.forEach(function(file){
        var obj = {name: file, path: dir};
        fileArray.push(obj);
    });
    return fileArray;
};

exports.array_to_csv = function (enList) {
  var str = "";
  _.each(enList, function (row) {
      var context = row.context || "";
      context = context.replace(/"/g, "\"\"");
      str += util.format('"%s","%s","%s","%s"\n', item._id, row.key, row.value.replace(/"/g, "\"\""), context);
  });
  return str;
};

/**
 * Packages local files into a ZIP archive
 *
 * @param {dir} directory of source files.
 * @param {name} the zip archive file name
 * return {void}
 */
exports.writeZip = function(dir,name,callback) {
    var zipName = name + ".zip",
            fileArray = getDirectoryList(dir),
            output = fs.createWriteStream(zipName),
            archive = archiver('zip');

    archive.pipe(output);
    output.on('close', function() {
        console.log('archiver has been finalized and the output file descriptor has closed.');
        // 执行回调函数
        callback(zipName);
    });
    fileArray.forEach(function(item){
        var file = item.path + item.name;
        archive.append(fs.createReadStream(file), { name: item.name });
    });

    archive.finalize(function(err, written) {
        if (err) {
            throw err;
        }
    });
};
// 生成最基本的语言格式
// 可以传参数，判断是否要生成json的形式，默认是要的
// 但是有一种情况是不需要的，就是pc端的语言包的时候，他是以点做参数的，但是它不需要转成json
var buildFileBase = function(langlist, enList, nojson){
    var all = {};
    _.each(langlist, function (lli) {
        // 首先循环遍历每一种语言
        _.each(enList, function (item) {
            // 接下来遍历语言key
            // 将这个语言的所有key value值都存起来
            //不存在这个语言
            if (!all[lli.langcode]) {
                all[lli.langcode] = {};
            }
            // 不需要转成json的方式，即最原始的key value 的方式
            if(nojson){
                var key =item["key"];
                try {
                    all[lli.langcode][key] = item["i18n"][lli.langcode];
                    // 如果是英文的话，直接取value 而不是取 i18["en"], 因为 value 才是最新的
                    if (!all[lli.langcode][key] || lli.langcode == "en") {
                        all[lli.langcode][key] = item.value;
                    }
                } catch (e) {
                    all[lli.langcode][key] = item.value;
                }
            }else{
                // 接下来判断是否有module存在, 以"."分割
                var keyArr = item["key"].split('.');
                if(keyArr.length == 2){
                    // 模块名
                    var module = keyArr[0];
                    // 该模块对应的key
                    var key = keyArr[1];
                    //不存在这个模块，就加进去
                    if (!all[lli.langcode][module]) {
                        all[lli.langcode][module] = {};
                    }
                    //无该语种，取英文
                    try {
                        all[lli.langcode][module][key] = item["i18n"][lli.langcode];
                        // 如果是英文的话，直接取value 而不是取 i18["en"], 因为 value 才是最新的
                        if (!all[lli.langcode][module][key] || lli.langcode == "en") {
                            all[lli.langcode][module][key] = item.value;
                        }
                    } catch (e) {
                        all[lli.langcode][module][key] = item.value;
                    }
                }else if(keyArr.length == 1){
                    // 有时候是没有模块名的，比如一些小项目
                    var key = keyArr[0];
                    try {
                        all[lli.langcode][key] = item["i18n"][lli.langcode];
                        // 如果是英文的话，直接取value 而不是取 i18["en"], 因为 value 才是最新的
                        if (!all[lli.langcode][key] || lli.langcode == "en") {
                            all[lli.langcode][key] = item.value;
                        }
                    } catch (e) {
                        all[lli.langcode][key] = item.value;
                    }
                }
            }
        });
    });
    return all;
};
// 生成语言文件
var buildJSFile = function(projectName,langlist, enList,finishCb, nameSpace){
    // 存放所有语言的key value
    var all = buildFileBase(langlist, enList);
    var length = langlist.length;
    // 接下来开始生产文件
    var finishCount = 0;
    _.each(langlist, function (lli,index) {
        var str = 'var ' + nameSpace + ' = ' + nameSpace + ' || {};\n';
        str += nameSpace + '.UsedLang = {};\n'+ nameSpace +'.Lang = '+ nameSpace +'.Lang || {};\n';
        str += nameSpace + ".Lang = {\n";
        for (var moduleKey in all[lli.langcode]) {
            // 如果这是有模块的
            if(_.isObject(all[lli.langcode][moduleKey])){
                str += '    "' + moduleKey + '": {\n';
                for (var itemKey in all[lli.langcode][moduleKey]) {
                    str += '        "' + itemKey + '":"' + all[lli.langcode][moduleKey][itemKey].replace(/"/g, '\\\"') + '",\n';
                }
                str = str.substring(0, str.length - 2);
                str += '\n    },\n';
            }else{
                // 如果不是对象,那么就一行
                str +=  '    "' + moduleKey + '" :"' + all[lli.langcode][moduleKey].replace(/"/g, '\\\"') + '",\n';
            }
        }
        str = str.substring(0, str.length - 2);
        str += '\n};\n';
        str += nameSpace + '.UsedLang = '+ nameSpace +'.Lang;';

        console.log("content=====>" + str);
        // 生成js文件
        fs.writeFile('storage/'+ projectName +'/build/js/' + lli.folder + '.js', str, 'utf-8',function(err){
            if(err) throw err;
            console.log(lli.langcode + ' has finished');
            finishCount += 1;
            if(finishCount == length){
                setTimeout(function(){
                    console.log("全部生成完毕");
                    if(_.isFunction(finishCb)){
                        finishCb();
                    }
                },100)
            }
        });
    });
};
// 生成json文件格式
var buildJsonFile = function(projectName,langlist, enList,finishCb){
    var all = buildFileBase(langlist, enList);
    var length = langlist.length;
    var finishCount = 0;
    _.each(langlist, function (lli,index) {
        var jsonStr = JSON.stringify(all[lli.langcode]);
        // 生成json文件
        fs.writeFile('storage/'+ projectName +'/build/json/' + lli.folder + '.json', jsonStr, 'utf-8',function(err){
            if(err) throw err;
            console.log(lli.langcode + ' has finished');
            finishCount += 1;
            if(finishCount == length){
                setTimeout(function(){
                    console.log("全部生成完毕");
                    if(_.isFunction(finishCb)){
                        finishCb();
                    }
                },100)
            }
        });
    });
};
// 生成 xml 文件
// todo 针对手机端的语言文件
var buildXMLFile = function(projectName,langlist, enList,finishCb){
    var all = buildFileBase(langlist, enList);
    var length = langlist.length;
    var finishCount = 0;
    _.each(langlist, function (lli,index) {
        //var xmlStr = JSON.stringify(all[lli.langcode]);
        var xmlArr = [];
        // 先添加最外层的属性
        xmlArr.push({ _attr: { "xmlns:tools": 'http://schemas.android.com/tools'}});
        // 获取xml 格式字符串
        var getXMLString = function(obj,originArr){
            originArr = originArr || [];
            _.each(obj,function(value,key){
                if(_.isObject(value)){
                    var tmpArr = [];
                    tmpArr.push({ _attr: { name: key.trim()}});
                    originArr.push({"string": getXMLString(value,tmpArr)});
                }else{
                    originArr.push({"string":[{ _attr: { name: key.trim()}}, value.trim()]});
                }
            });
            return originArr;
        };
        getXMLString(all[lli.langcode],xmlArr);
        var xmlStr = xml({"resources": xmlArr},true);
        //xmlStr = xmlStr.replace(/\<!\[cdata\[([\w\W]*?)\]\]\>/ig,"$1");;
        xmlStr = _.str.unescapeHTML(xmlStr);
        console.log(xmlStr);
        // 生成xml文件
        fs.writeFile('storage/'+ projectName +'/build/xml/' + lli.folder + '.xml', xmlStr, 'utf-8',function(err){
            if(err) throw err;
            console.log(lli.langcode + ' has finished');
            finishCount += 1;
            if(finishCount == length){
                setTimeout(function(){
                    console.log("全部生成完毕");
                    if(_.isFunction(finishCb)){
                        finishCb();
                    }
                },100)
            }
        });
    });
};
// 生成csv文件（包含注释）
var buildCSVFile = function(projectName,langlist, enList,finishCb){
    var length = langlist.length;
    var finishCount = 0;
    db.project_list.findOne({name:projectName}, function (err, row) {
        if (err) {
            throw err;
        }
        // 是否要带id (如果要上平台的话，要保证跟crowdin的id一致)
        // 默认是要的，目前只有手机端的项目才不用
        var hasId = row.hasId || "1";
        _.each(langlist, function (lli,index) {
            var str = '';
            var langcode = lli.langcode;
            // 这边可以选择，如果i18n中的value没有的话，是否要用英文代替
            _.each(enList, function (row) {
                var context = row.context || "";
                var value = row.value || "";
                row.i18n = row.i18n || {};
                if(langcode != 'en'){
                    // 如果不存在就，使用英语的value
                    value = row.i18n[langcode] || value;
                }
                value = value.replace(/"/g, "\"\"");
                context = context.replace(/"/g, "\"\"");
                // 有id的话，加id
                if(hasId === '1'){
                    str += util.format('"%s","%s","%s","%s"\n', row._id, row.key, value, context);
                }else{
                    str += util.format('"%s","%s","%s"\n', row.key, value, context);
                }
            });
            fs.writeFile('storage/'+ projectName +'/build/csv/' + lli.folder + '.csv', str, 'utf-8',function(err){
                if(err) throw err;
                console.log(lli.langcode + ' has finished');
                finishCount += 1;
                if(finishCount == length){
                    setTimeout(function(){
                        console.log("全部生成完毕");
                        if(_.isFunction(finishCb)){
                            finishCb();
                        }
                    },100)
                }
            });
        });
    });
};
// 生成 txt 文件
// todo 针对pc端的语言文件
var buildTXTFile = function(projectName,langlist, enList,finishCb,options){
    // 这里不需要转成json的格式
    var all = buildFileBase(langlist, enList,true);
    var length = langlist.length;
    var finishCount = 0;
    // txt 格式可以指定具体的后缀名
    var ext_name = options.txt_ext || "txt";
    // 判断是否需要加引号
    var hasQuote = options.txt_quote === "1";
    _.each(langlist, function (lli,index) {
        var str = '';
        for (var moduleKey in all[lli.langcode]) {
            if(hasQuote){
                str +=  '"' + moduleKey + '" = "' + all[lli.langcode][moduleKey].replace(/"/g, '\\\"') + '";\n';
            }else{
                //str +=  ' ' + moduleKey + ' = ' + all[lli.langcode][moduleKey].replace(/"/g, '\\\"') + '\n';
                // 这边不转义引号
                str +=  '' + moduleKey + ' = ' + all[lli.langcode][moduleKey] + '\n';
            }
        }
        console.log("content=====>" + str);
        // 生成js文件
        fs.writeFile('storage/'+ projectName +'/build/txt/' + lli.folder + '.' + ext_name, str, 'utf-8',function(err){
            if(err) throw err;
            console.log(lli.langcode + ' has finished');
            finishCount += 1;
            if(finishCount == length){
                setTimeout(function(){
                    console.log("全部生成完毕");
                    if(_.isFunction(finishCb)){
                        finishCb();
                    }
                },100)
            }
        });
    });
};
exports.buildFile = function(projectName,ext,finishCb,options){
    var nameSpace = "Airdroid";
    // 查找该集合的内容
    db.project_list.findOne({name:projectName}, function (err, row) {
        if (err) {
            console.log(err);
        } else {
            nameSpace = row.namespace;
            // 获取所有的语言列表
            getCollectionList(projectName).find().toArray(function (err, allLanglist) {
                //获取语言的key值
                getCollectionLang(projectName).find().sort({key: 1}).toArray(function (err, enList) {
                    if (err){
                        throw err;
                    }
                    // 接下来要判断要生成的格式
                    switch(ext){
                        case "js":
                            buildJSFile(projectName,allLanglist,enList,finishCb,nameSpace);
                            break;
                        case "json":
                            buildJsonFile(projectName,allLanglist,enList,finishCb);
                            break;
                        case "xml":
                            buildXMLFile(projectName,allLanglist,enList,finishCb);
                            break;
                        case "txt":
                            // 由于 txt 可以导出不同的格式，因此，每一次导出的时候，都要清空原来的文件
                            var path = 'storage/'+ projectName + '/build/txt';
                            // 先清掉文件夹里面的东西
                            exports.clearDir(path,function(){
                                // 导出文本格式，目前用于pc端，因此具有特殊性
                                buildTXTFile(projectName,allLanglist,enList,finishCb,options);
                            });
                            break;
                        case "csv":
                            buildCSVFile(projectName,allLanglist,enList,finishCb);
                            break;
                    }
                });
            });
        }
    });
};