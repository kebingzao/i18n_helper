//前端部分route

var fs = require("fs");
var csv = require("csv");
var xml2js = require("xml2js");
var _ = require('underscore');
var api = require('../libs/crowdin');
var airRmdir = require('rimraf');
var unzip = require('unzip');
// 该插件也要依赖Python
var J = require('j');
// 数据库
var db = require("../global").database;
// 管理员相关
var admin = require("../global").admin;
var util = require('util');
var airHelper = require('../libs/helpers');
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

// 获取该项目的基本配置详情
function getProjectSetting(projectName, callback, errcb, res){
    var failCb = function(err) {
        if(_.isFunction(errcb)){
            errcb(err);
        }else{
            res && renderTip(res,"不存在该项目");
        }
    };
    db.project_list.findOne({name:projectName}, function (err, row) {
        if (err) {
            failCb(err);
            throw err;
        } else {
            if(row){
                _.isFunction(callback) && callback(row);
            }else{
                failCb();
            }
        }
    });
}

// 获取默认的语言项
function getLangItem(item){
    // 添加默认项
    item.context = item.context || "";
    item.i18n = item.i18n || {"en":item.value};
    // 中文注释，不上平台，自己人看的
    item.des = item.des || item.context || "";
    return item;
}

// 调整到成功页面
function renderSuccess (res,projectName,msgArr){
    var newMsgArr = [].concat(msgArr);
    // 进行数组反转
    //newMsgArr = newMsgArr.reverse();
    res.redirect('web/project/'+ projectName + "/success/" + encodeURIComponent(newMsgArr.join("=====")));
}
// 提示页面
function renderTip (res,msgArr){
    var newMsgArr = [].concat(msgArr);
    // 进行数组反转
    //newMsgArr = newMsgArr.reverse();
    res.redirect('web/tip/' + encodeURIComponent(newMsgArr.join("=====")));
}

// 保存本地维护中的未审核数组
function updateLocalMainentKey (projectName, obj, callback){
    updateProjectSetting(projectName,{
        "LocalMaintenance": obj
    },callback);
}

// 保存项目配置
function updateProjectSetting(projectName,obj, callback){
    db.project_list.update({"name": projectName}, {'$set':obj}, function (err,result) {
        if (err) throw err;
        _.isFunction(callback) && callback();
    })
}

//判断当前是否有本地维护并且含有未审核的key
function checkHasUnverifyLocalManientKey(projectName, langArr, callback){
    var flag = false;
    getProjectSetting(projectName,function(row){
        if(row.crowdin == '1'){
            var localMaintenance = row.LocalMaintenance || {};
            // 判断是否有本地维护语言
            _.each(langArr,function(item){
                // 必须要有值
                console.log("要检查的语言"+ item);
                if(localMaintenance[item] && localMaintenance[item].length > 0){
                    flag = true;
                }
            });
            _.isFunction(callback) && callback(flag);
        }else{
            _.isFunction(callback) && callback(flag);
        }
    })
}

// 审核本地维护语言的key
function verifyLocalManient(projectName, langArr, delKeyArr, callback){
    getProjectSetting(projectName,function(row){
        if(row.crowdin == '1'){
            delKeyArr = delKeyArr || [];
            var localMaintenance = row.LocalMaintenance || {};
            _.each(langArr,function(item){
                if(localMaintenance[item] && _.isArray(localMaintenance[item])){
                    _.each(delKeyArr,function(delKey){
                        localMaintenance[item] = _.without(localMaintenance[item], delKey);
                    });
                }
            });
            // 接下来就更新
            updateLocalMainentKey(projectName,localMaintenance,callback);
        }else{
            _.isFunction(callback) && callback();
        }
    })
}

// 获取本地维护语言的语种
function getLocalMainentLangList (projectName,callback){
    getCollectionList(projectName).find({"local":"1"}).sort({langcode: 1}).toArray(function (err, list) {
        list = list || [];
        _.isFunction(callback) && callback(list);
    });
}

// 插入一条新的词条，是否要判断某些字段是否存在
function insertSingleLang (projectName, obj){
    // 要插入的字段
    var insertObj = obj.insertObj;
    // 插入成功之后的回调
    var insertSuccessCb = obj.insertSuccessCb;
    // 插入失败之后的回调
    var insertFailCb = obj.insertFailCb;
    // 是否需要筛选，比如key不能重复，如果重复，那么就是插入失败
    var filterObj = obj.filterObj;
    // 筛选失败的回调
    var filterCb = obj.filterCb;
    var insertItem = function(){
        // 不存在，那就插入
        getCollectionLang(projectName).insert(getLangItem(insertObj), function (err, data) {
            if (err){
                _.isFunction(insertFailCb) && insertFailCb();
                throw err;
            }
            console.log(data);
            _.isFunction(insertSuccessCb) && insertSuccessCb();
        });
    };
    if(filterObj){
        getCollectionLang(projectName).findOne(filterObj, function (err, row) {
            if(row && !_.isEmpty(row)){
                // 存在就插入失败
                _.isFunction(filterCb) && filterCb();
            }else{
                // 那就插入
                insertItem();
            }
        });
    }else{
        insertItem();
    }
}

//WEB首页
exports.index = function (req, res) {
    // 列出所有的项目
  db.project_list.find().sort({name: 1}).toArray(function (err, list) {
      if (err){
          console.log("err: " + err);
          throw err;
      }
    res.render('web/index', { allProject: list});
  });
};
exports.showProject = function (req, res) {
    res.redirect('web/');
};

// 显示提示页面
exports.showTip = function (req, res) {
    var msg = req.params.msg;
    res.render('web/tip', {
        msg: msg
    });
};


// 项目操作
exports.project = {
    // 添加一个项目
    add : function(req, res) {
        if (req.method == "GET") {
            res.render('web/project/add', {msg: undefined, error: undefined});
        } else if (req.method == "POST") {
            var name = req.body["name"];
            var des = req.body["des"];
            var namespace = req.body["namespace"];
            var owner = req.body["owner"];
            var package = req.body["package"];
            // 是否上平台
            var crowdin = req.body["crowdin"];
            // 语言模式是否带id
            var hasId = req.body["hasId"];
            // 判断是否存在该名称的项目
            getProjectSetting(name,function(row){
                // 已经存在该项目，出提示
                res.render('web/project/add', {msg: "该项目已经存在！", error: "1"});
            }, function(){
                // 不存在就插入
                // 不存在直接插入
                db.project_list.insert({
                    name: name,
                    des:des,
                    namespace:namespace,
                    owner:owner,
                    package:package,
                    crowdin:crowdin,
                    hasId:hasId
                }, function (err, data) {
                    if (err){
                        throw err;
                    }
                    var msg = "添加项目成功，为" + name;
                    // 这时候要默认增加一条英语
                    getCollectionList(name).insert({
                        "name":"英语",
                        "langcode":"en",
                        "folder":"en"
                    }, function (err, list) {
                        if (err){
                            console.log("err: " + err);
                            throw err;
                        }
                        res.render('web/project/add', {msg: msg, error: undefined});
                    });
                    // 创建相应的目录
                    // 先判断是否存在旧目录
                    var dirPath = 'storage/' + name;
                    // 创建目录
                    var createProjectDir = function(){
                        var dirObj = {
                            build: ["csv","js","json","xml","crowdin_csv",'txt'],
                            tmp: ""
                        };
                        // 先建该项目的根目录
                        fs.mkdir(dirPath,function(err){
                            if(!err){
                                // 再建子目录
                                _.each(dirObj,function(value,key){
                                    // 先建子目录
                                    fs.mkdir(dirPath + "/" + key,function(err){
                                        if(!err){
                                            // 然后再建子目录的子目录
                                            if(_.isArray(value)){
                                                // 如果value是数组，那么再建子目录
                                                _.each(value,function(item){
                                                    fs.mkdir(dirPath + "/" + key + "/" + item,function(err){
                                                        if(!err){

                                                        }
                                                    })
                                                })
                                            }
                                        }
                                    })
                                })
                            }
                        })
                    };
                    console.log("当前目录为:" + __dirname);
                    fs.exists(dirPath,function(exists){
                        if(exists){
                            console.log("存在该目录");
                            // 那么将该目录删掉
                            airRmdir(dirPath,function(err){
                                if(!err){
                                    console.log("删除目录成功");
                                    // 先删除旧的，再新建新的
                                    createProjectDir();
                                }else{
                                    console.log("删除目录失败");
                                }
                            })
                        }else{
                            console.log("不存在该目录");
                            createProjectDir();
                        }
                    });
                    console.log(msg);
                });
            });
        }
    },
    // 修改项目详情
    edit : function (req, res) {
        // 获取项目名称
        var name = req.params.name;
        if (req.method == "GET") {
            getProjectSetting(name,function(row){
                res.render('web/project/edit', {
                    msg: undefined,
                    error: undefined,
                    project: row
                });
            }, null, res);
        } else if (req.method == "POST") {
            var name = req.body["name"];
            var des = req.body["des"];
            var namespace = req.body["namespace"];
            var owner = req.body["owner"];
            // 对应项目的文件名字
            var package = req.body["package"];
            // 是否上平台
            var crowdin = req.body["crowdin"];
            // 语言模式是否带id
            var hasId = req.body["hasId"];
            getProjectSetting(name,function(row) {
                // 更新项目
                var updateProject = function(){
                    db.project_list.update({"name": name}, {'$set':{
                        'des':des,
                        "namespace":namespace,
                        "owner":owner,
                        "package": package,
                        "crowdin": crowdin,
                        "hasId": hasId
                    }}, function (err,result) {
                        if (err) throw err;
                        getProjectSetting(name,function(row) {
                            res.render('web/project/edit', {
                                msg: "修改成功",
                                error: undefined,
                                project: row
                            });
                        });
                    })
                };
                // 如果有从上crowin平台变成不上，这时候要去判断有没有本地维护的并且没有审核过的语句
                var oldCrowdin = row.crowdin || "0";
                if(oldCrowdin == "1" && crowdin == "0"){
                    getLocalMainentLangList(name,function(list){
                        checkHasUnverifyLocalManientKey(name,_.map(list,function(langItem){
                            return langItem.langcode;
                        }),function(result){
                            if(result){
                                renderSuccess(res,name,"检测到该项目还存在未审核的语句，请先去把语句审核完再来修改");
                            }else{
                                updateProject();
                            }
                        })
                    });
                }else{
                    updateProject();
                }
            },null,res);
        }
    },
    // 显示该项目的语言情况
    show : function (req, res) {
        // 获取项目名称
        var name = req.params.name;
        // 查找该集合的内容
        getProjectSetting(name,function(row) {
            console.log("get project" + name );
            // 接下来查找该项目所对应的 语言列表
            getCollectionList(name).find().toArray(function (err, list) {
                if (err){
                    console.log("err: " + err);
                    throw err;
                }
                res.render("web/project/show", {
                    project:row,
                    list:list
                });
            });
        },null,res);
    },
    //生成语言文件
    buildFile : function (req, res) {
        var projectName = req.params.name;
        var ext = req.params.ext;
        var nameSpace = "Airdroid";
        if (req.method == "GET" && !ext) {
            res.render('web/project/build', {
                projectName: projectName
            });
        } else if (req.method == "POST" || ext) {
            // 判断要导出的格式
            ext = ext || req.body["ext"];
            airHelper.buildFile(projectName,ext,function(){
                renderSuccess(res,projectName,"生成语言文件成功");
            });
        }
    },
    //删除该项目
    delete : function (req, res) {
        var projectName = req.params.name;
        var token = req.body.token;
        // 判断token是否合法
        if(token == admin.pwd){
            // 相同，可以删除
            db.project_list.remove({"name": projectName}, function (err, result) {
                if (err) {
                    throw err;
                }
                // 删除对应的表
                try{
                    getCollectionLang(projectName).drop(function(){
                        console.log("删除" + projectName + "的lang集合成功");
                    });
                }catch (e){

                }
                try{
                    getCollectionList(projectName).drop(function(){
                        console.log("删除" + projectName + "的list集合成功");
                    })
                }catch (e){

                }
                // 接下来删除对应的文件夹
                airRmdir('storage/' + projectName,function(err){
                    if(!err){
                        console.log("删除目录成功");
                    }else{
                        console.log("删除目录失败");
                    }
                });
                res.send('success');
            });
        }else{
            res.send('fail');
        }
    },
    // 生成上crowdin 平台的 CSV文件
    exportCrowdinCSV : function (req, res) {
        var projectName = req.params.name;
        // 这边只生成英语的csv文件
        // 获取crowdin 平台上的文件名
        getProjectSetting(projectName,function(row) {
            var package = row.package || projectName;
            // 是否要带id (如果要上平台的话，要保证跟crowdin的id一致)
            // 默认是要的，目前只有手机端的项目才不用
            var hasId = row.hasId || "1";
            getCollectionLang(projectName).find().toArray(function (err, enList) {
                if (err) {
                    throw err;
                }
                console.log('begin build CSV file------------------------------');
                var str = '';
                _.each(enList, function (row) {
                    var context = row.context || "";
                    var value = row.value;
                    context = context.replace(/"/g, "\"\"");
                    // 有id的话，加id
                    if(hasId === '1'){
                        str += util.format('"%s","%s","%s","%s"\n', row._id, row.key, value.replace(/"/g, "\"\""), context);
                    }else{
                        str += util.format('"%s","%s","%s"\n', row.key, value.replace(/"/g, "\"\""), context);
                    }
                });

                // csv().from(str).to.path("storage/"+ projectName +"/build/csv/web.csv");
                var package_file_name = "storage/"+ projectName +"/build/crowdin_csv/"+ package +".csv";
                fs.writeFile(package_file_name, str, 'utf-8',function(err){
                    if(err) throw err;
                    //renderSuccess(res,projectName,"生成最新的csv文件成功");
                    // 下载到本地
                    res.download(package_file_name);
                });
            });
        },null,res);
    },
    //导入最新的翻译结果（从crowdin上下载最新的语言包文件，其实就是导入csv文件）
    importTranslate : function (req, res) {
        var projectName = req.params.name;
        var packageName = "";
        var hasId = "1";
        var log_arr = [];
        // 导入成功
        var importFinish = function(){
            log_arr.push("导入最新翻译结束");
            var updateTime = (new Date()).getTime();
            // 记录这一次的时间
            updateProjectSetting(projectName,{
                "updateTime": updateTime
            });
            renderSuccess(res,projectName, log_arr);
        };
        // 检查语言
        var checkLang = function (enLang, allLanglist, i) {
            var langcode = allLanglist[i].langcode;
            // 继续下一门语言
            var goNextLang = function(){
                if (i + 1 < allLanglist.length) {
                    checkLang(enLang, allLanglist, i + 1);
                }else{
                    importFinish();
                }
            };
            // 判断该语言，是否是本地维护语言
            getCollectionList(projectName).findOne({"langcode":langcode},function (err, result) {
                if (err) {
                    console.log(err);
                } else {
                    // 判断是否是本地维护语言
                    var isLocal = result.local === '1';
                    // 如果是本地维护的语言，直接跳过
                    if(isLocal){
                        log_arr.push(langcode + "语种属于本地维护，不进行导入操作");
                        goNextLang();
                    }else{
                        //获取一种语言
                        fs.readFile('storage/'+ projectName +'/tmp/' + allLanglist[i].folder + '/'+ packageName +'.csv', function (err, data) {
                            if (err) {
                                // 如果读取错误，就继续下一个
                                //继续下一种语言
                                var str_log = "读取不到"+ allLanglist[i].folder + '文件夹,导入该语言失败';
                                log_arr.push(str_log);
                                console.log(str_log);
                                goNextLang();
                                //throw err;
                            }else{
                                csv().from(data.toString())
                                        .on('record', function (data, index) {
                                            // todo
                                            // 注意，这里不修改 原来的key和value，这是因为 要以助手的英语为主
                                            // 所以要严禁在 cowdin上面修改英语的key和value，不然会导致 key value 跟 i18n 里面 en 的 value 不同，造成 bug
                                            // 这里也不修改key , context 的值
                                            // 这边要判断是否有带id
                                            if(hasId == '1'){
                                                // [0] 为 id， [1] 为 key , [2] 为 value, [3] 为 context
                                                getCollectionLang(projectName).findOne({"_id": db.ObjectID.createFromHexString(data[0])}, function (err, row) {
                                                    if(row){
                                                        try{
                                                            // 这边要用try catch 捕捉一下错误，因为有时候，本地的语言与crowdin的语言文件有一些不同
                                                            // 这时候以本地的英语为准
                                                            if (row.i18n) {
                                                                row.i18n[allLanglist[i].langcode] = data[2];
                                                            } else {
                                                                row.i18n = {};
                                                                row.i18n[allLanglist[i].langcode] = data[2];
                                                            }
                                                            delete row._id;
                                                            // 这边要更新为最新的id，与crowdin上面的id为准
                                                            getCollectionLang(projectName).update({"_id": db.ObjectID.createFromHexString(data[0])}, row, function () {
                                                            })
                                                        }catch(e){
                                                            console.log(e);
                                                        }
                                                    }else{
                                                        var str_log = "导入"+ allLanglist[i].folder +"的时候，在英语文件中，找不到key:" + data[0];
                                                        log_arr.push(str_log);
                                                        console.log(str_log);
                                                    }
                                                });
                                            }else{
                                                // todo 如果没有带id，比如手机端项目
                                                // [0] 为 key， [1] 为 value , [2] 为  context
                                                getCollectionLang(projectName).findOne({"key": data[0]}, function (err, row) {
                                                    if(row){
                                                        try{
                                                            // 这边要用try catch 捕捉一下错误，因为有时候，本地的语言与crowdin的语言文件有一些不同
                                                            // 这时候以本地的英语为准
                                                            if (row.i18n) {
                                                                row.i18n[allLanglist[i].langcode] = data[1];
                                                            } else {
                                                                row.i18n = {};
                                                                row.i18n[allLanglist[i].langcode] = data[1];
                                                            }
                                                            // 这边要更新
                                                            getCollectionLang(projectName).update({"key": data[0]}, row, function () {
                                                            })
                                                        }catch(e){
                                                            console.log(e);
                                                        }
                                                    }else{
                                                        var str_log = "导入"+ allLanglist[i].folder +"的时候，在英语文件中，找不到key:" + data[0];
                                                        log_arr.push(str_log);
                                                        console.log(str_log);
                                                    }
                                                });
                                            }
                                        })
                                        .on('error', function(err){
                                            var str_log = allLanglist[i].folder + '文件夹中的csv解析失败,导入该语言失败,错误原因：' + err.message;
                                            log_arr.push(str_log);
                                            console.log(str_log);
                                            goNextLang();
                                        })
                                        .on('end', function () {
                                            console.log('end');
                                            //继续下一种语言
                                            if (i + 1 < allLanglist.length) {
                                                (function(index){
                                                    // 这边要有个时间间隔，不然后面会覆盖前面的操作，导致只有最后一个语言是成功的
                                                    setTimeout(function(){
                                                        checkLang(enLang, allLanglist, index);
                                                    },2000);
                                                })(i+1);
                                            }else{
                                                setTimeout(function(){
                                                    console.log("导入最新翻译成功");
                                                    // 导入结束
                                                    importFinish();
                                                },2000);
                                            }
                                        });
                            }
                        });
                    }
                }
            });
        };
        getProjectSetting(projectName, function (row) {
            // 获取crowdin上面的名字
            packageName = row.package || "web";
            // 这时候要判断是否有带id，
            hasId = row.hasId || "1";
            // 循环遍历语言
            getCollectionLang(projectName).find().toArray(function (err, enList) {
                if (err) {
                    throw err;
                }
                //从list 获取全部的语言列表
                getCollectionList(projectName).find().toArray(function (err, allLanglist) {
                    // 一个一个检查过去
                    checkLang(enList, allLanglist, 0);
                });
            });
        },null, res);
    },
    // 导出语言文件到本地
    downloadFile : function (req, res) {
        var projectName = req.params.name;
        var options = null;
        if (req.method == "GET") {
            res.render('web/project/download', {
                projectName: projectName
            });
        } else if (req.method == "POST") {
            // 判断要导出的格式
            var ext = req.body["ext"];
            var baseUrl = process.cwd() + "/storage/"+ projectName +"/build/";
            var target_name = "";
            switch (ext){
                case "js":
                    target_name = baseUrl + "js/";
                    break;
                case "json":
                    target_name = baseUrl + "json/";
                    break;
                case "xml":
                    target_name = baseUrl + "xml/";
                    break;
                case "txt":
                    target_name = baseUrl + "txt/";
                    // 这边要带上额外参数‘
                    options = {
                        // 指定后缀名
                        txt_ext : req.body["txt_ext"],
                        // 是否带引号
                        txt_quote : req.body["txt_quote"]
                    };
                    break;
                case "csv":
                    target_name = baseUrl + "csv/";
                    break;
            }
            // 先生成，再下载
            airHelper.buildFile(projectName,ext,function(){
                // 最后下载
                airHelper.writeZip(target_name,baseUrl + projectName + "_" + ext + "_lang",function(zipName){
                    // 下载到本地
                    res.download(zipName);
                });
            },options);
        }
    },
    // 导入词条文件，用来增加词条
    // todo 这边只能上传英语版本的，其他语言不能上传
    // 这个有含ID的
    importFile : function (req, res) {
        var projectName = req.params.name;
        if (req.method == "GET") {
            res.render('web/project/import', {
                projectName: projectName
            });
        } else if (req.method == "POST") {
            // 判断要导入的格式
            var ext = req.body["ext"];
            // 是否要覆盖id (如果要上平台的话，要保证跟crowdin的id一致)
            var hasId = req.body["hasId"];
            // 判断csv的格式，是3行，还是4行
            var csvType = req.body["csvType"];
            // 插入记录
            var insertItem = function(item,callback){
                getCollectionLang(projectName).insert(item, function (err, data) {
                    if (err) {
                        throw err;
                    }
                    if(_.isFunction(callback)){
                        callback();
                    }
                });
            };
            // 一条一条插入数据库
            var insertOneByOne = function(allItems, success_count, log_arr){
                var item = allItems.shift();
                insertSingleLang(projectName,{
                    insertObj: item,
                    insertSuccessCb: function(){
                        success_count += 1;
                        if(_.isEmpty(allItems)){
                            log_arr.push("导入成功，共导入" + success_count + "条数据");
                            renderSuccess(res,projectName,log_arr);
                        }else{
                            // 递归遍历
                            insertOneByOne(allItems, success_count, log_arr);
                        }
                    },
                    filterObj: {
                        "key": item.key
                    },
                    filterCb: function(){
                        log_arr.push("重复key：==>" + item.key + ",不进行插入");
                        if(_.isEmpty(allItems)){
                            log_arr.push("导入成功，共导入" + success_count + "条数据");
                            renderSuccess(res,projectName,log_arr);
                        }else{
                            insertOneByOne(allItems, success_count, log_arr);
                        }
                    }
                })
            };
            // json数据插入数据
            var jsonInsert = function(obj){
                var tmp = [];

                for (var k in obj) {
                    if(_.isObject(obj[k])){
                        for (var j in obj[k]) {
                            var tmpObj = {};
                            tmpObj["key"] = k + "." + j;
                            tmpObj["value"] = obj[k][j];
                            tmp.push(getLangItem(tmpObj));
                        }
                    }else{
                        var tmpObj = {};
                        tmpObj["key"] = k;
                        tmpObj["value"] = obj[k];
                        tmp.push(getLangItem(tmpObj));
                    }
                }
                // 插入数据
                insertOneByOne(tmp,0,[]);
            };
            fs.readFile(req.files.file.path, function (err, data) {
                if (err) {
                    throw err;
                }
                //console.log("File Content:" + data.toString());
                switch(ext){
                    case "csv":
                        var cnt = [];
                        csv().from(data.toString())
                                .on('record', function (data, index) {
                                    cnt.push(data);
                                })
                                .on('end', function (count) {
                                    //将 cnt 插入数据库
                                    // 首先要判断是否要覆盖id
                                    // 如果是 4行的
                                    if(csvType == '1'){
                                        if(hasId === "1"){
                                            _.each(cnt,function(item){
                                                // [0] 为 id， [1] 为 key , [2] 为 value, [3] 为 context
                                                var itemId = item[0];
                                                var itemKey = item[1];
                                                var itemValue = item[2];
                                                var itemContext = item[3] || "";
                                                // 插入记录
                                                var insertItemHasId = function(){
                                                    insertItem(getLangItem({
                                                        _id: db.ObjectID.createFromHexString(itemId),
                                                        key: itemKey,
                                                        value: itemValue,
                                                        context: itemContext
                                                    }));
                                                };
                                                // 查看是否存在该词条，如果存在，就先删掉，再插入
                                                getCollectionLang(projectName).findOne({"_id": db.ObjectID.createFromHexString(itemId)}, function (err, row) {
                                                    if(row){
                                                        getCollectionLang(projectName).remove({"_id": db.ObjectID.createFromHexString(itemId)}, function (err, result) {
                                                            if (err) throw err;
                                                            console.log("delete success，" + result);
                                                            // 删掉重新插入
                                                            insertItemHasId();
                                                        });
                                                    }else{
                                                        // 不存在，就直接插入
                                                        insertItemHasId();
                                                    }
                                                });
                                            });
                                            renderSuccess(res,projectName,"导入成功，共导入" + cnt.length + "条数据");
                                        }else{
                                            // 不用覆盖id的，直接插入
                                            var obj = [];
                                            _.each(cnt,function(item){
                                                // [0] 为 id， [1] 为 key , [2] 为 value, [3] 为 context
                                                var itemKey = item[1];
                                                var itemValue = item[2];
                                                var itemContext = item[3] || "";
                                                // 要有key值，才插入
                                                if(itemKey){
                                                    obj.push({
                                                        key: itemKey,
                                                        value: itemValue,
                                                        context: itemContext
                                                    })
                                                }
                                            });
                                            // 最后一条一条插进去
                                            insertOneByOne(obj,0,[]);
                                        }
                                    }else{
                                        var obj = [];
                                        // 如果是 3行的
                                        _.each(cnt,function(item){
                                            // [0] 为 key , [1] 为 value, [2] 为 context
                                            var itemKey = item[0];
                                            var itemValue = item[1];
                                            var itemContext = item[2] || "";
                                            // 要有key值，才插入
                                            if(itemKey){
                                                obj.push({
                                                    key: itemKey,
                                                    value: itemValue,
                                                    context: itemContext
                                                })
                                            }
                                        });
                                        // 最后一条一条插进去
                                        insertOneByOne(obj,0,[]);
                                    }
                                    console.log(cnt);
                                });
                        break;
                    case "json":
                        // 如果是json格式，那么是不包含id的
                        var obj = JSON.parse(data.toString());
                        jsonInsert(obj);
                        break;
                    case "js":
                        // 如果是js格式，那么要进行一下过滤，只取中间的json字符串
                        var obj = {};
                        try{
                            obj = JSON.parse(data.toString().replace(/.*\W*.*(=\W*(\{[\w\W]+\})).*/ig, '$2'));
                            jsonInsert(obj);
                        }catch(e){
                            renderSuccess(res,projectName,"导入失败，js格式不符合");
                        }
                        break;
                    case "xml":
                        // xml 主要用于手机端的多语言
                        // 将xml转化为json字符串
                        // todo 不同的语言包xml有不同的形式，这里跟进手机端的xml格式来取数据
                        try{
                            xml2js.parseString(data.toString(), function (err, result) {
                                // 根据一定的格式来取出数据，注意这个是跟进手机端的格式
                                var data = result["resources"]["string"];
                                var obj = {};
                                _.each(data,function(item){
                                    // 不为空
                                    if(item["$"].name.trim()){
                                        obj[item["$"].name.trim()] = item["_"].trim();
                                    }
                                });
                                // 插入数据
                                jsonInsert(obj);
                                //console.dir(JSON.stringify(obj));
                            });
                        }catch(e){
                            renderSuccess(res,projectName,"导入失败，格式不符合");
                        }
                        break;
                    case "txt":
                        // 文本格式的，主要是用来兼容pc端的
                        // pc 端和 手机端一样，都是不带表id，甚至只有两行，不带 context 以等号 连接
                        // 比如 "ContactRecordController.No.Record.Prompt"		= "No Contact";
                        // 因此具有一定的特殊性
                        // 先按行分割
                        var str_arr = data.toString().trim().split(/\r?\n/ig);
                        // 接下来去掉空行和注释行
                        // 如果找不到等号，那么就是注释行
                        str_arr = _.filter(str_arr,function(item){
                            return /[=]/.test(item);
                        });
                        console.log(str_arr.join("$$$$"));
                        try{
                            // 接下来就通过匹配 “=“ 来获取key和value
                            var obj = {};
                            _.each(str_arr,function(item){
                                var matchArr = item.trim().match(/^"?(.*?)"?\s*=\s*"?(.*?)"?;?$/);
                                if(_.isArray(matchArr) && matchArr.length == 3){
                                    obj[matchArr[1].trim()] = matchArr[2].trim();
                                }else{
                                    console.log("不符合规矩，过滤掉");
                                }
                            });
                            // 插入数据
                            jsonInsert(obj);
                        }catch(e){
                            renderSuccess(res,projectName,"导入失败，请按照合格的规矩来");
                        }
                        break;
                }
            });
        }
    },
    // 导入 i18n 翻译源文件
    importI18nFile : function (req, res) {
        var projectName = req.params.name;
        if (req.method == "GET") {
            getCollectionList(projectName).find().sort({langcode: 1}).toArray(function (err, list) {
                // 获取该项目的多语言语言
                list = _.filter(list,function(item){
                    return (item.langcode != "en");
                });
                res.render('web/project/importI18n', {
                    projectName: projectName,
                    langlist: list
                });
            });
        } else if (req.method == "POST") {
            // 判断要导入的格式
            var ext = req.body["ext"];
            // 判断要导入的语言
            var langcode = req.body["langcode"];
            // log 数组
            var log_arr = [];
            // 总的条数
            var total_count = 0;
            // 成功导入次数
            var success_count = 0;
            // 失败次数
            var fail_count = 0;
            // 导入成功事件
            var importSuccess = function(){
                log_arr.push("导入成功，共导入" + success_count + "条数据");
                renderSuccess(res,projectName,log_arr);
            };
            // 导入失败事件
            var importFailed = function(){
                log_arr.push("导入失败，请按照合格的规矩来");
                renderSuccess(res,projectName,log_arr);
            };
            // 判断是否需要执行成功事件
            var checkFinish = function(success){
                if(success){
                    success_count += 1;
                }else{
                    fail_count += 1;
                }
                if((success_count + fail_count) == total_count){
                    // 执行成功
                    importSuccess();
                }
            };
            // 更新i18n翻译
            var updateI18n = function(key,i18n_value){
                try{
                    getCollectionLang(projectName).findOne({"key": key}, function (err, row) {
                        if (err) {
                            console.log(err);
                            checkFinish();
                        } else {
                            try{
                                row.i18n = row.i18n || {};
                                row.i18n[langcode] = i18n_value;
                                // 最后更新
                                getCollectionLang(projectName).update({"key": key},  row, function (err, result) {
                                    if (err) {
                                        log_arr.push("导入失败，key为：" + key);
                                        //throw err;
                                        checkFinish();
                                    }else{
                                        checkFinish(true);
                                    }
                                });
                            }catch(e){
                                log_arr.push("出现一个错误，key为：" + key);
                                checkFinish();
                            }
                        }
                    });
                }catch(e){
                    checkFinish();
                }
            };
            switch(ext){
                case "txt":
                    fs.readFile(req.files.file.path, function (err, data) {
                        if (err) {
                            throw err;
                        }
                        //console.log("File Content:" + data.toString());
                        var str_arr = data.toString().trim().split(/\r?\n/ig);
                        // 接下来去掉空行和注释行
                        // 如果找不到等号，那么就是注释行
                        str_arr = _.filter(str_arr,function(item){
                            return /[=]/.test(item);
                        });
                        console.log(str_arr.join("$$$$"));
                        try{
                            // 接下来就通过匹配 “=“ 来获取key和value
                            total_count = str_arr.length;
                            _.each(str_arr,function(item){
                                var matchArr = item.trim().match(/^"?(.*?)"?\s*=\s*"?(.*?)"?;?$/);
                                if(_.isArray(matchArr) && matchArr.length == 3){
                                    // 然后插入
                                    // 接下来就插入到i18n中
                                    var key = matchArr[1];
                                    var i18n_value = matchArr[2];
                                    updateI18n(key,i18n_value);
                                }else{
                                    log_arr.push("不符合规矩，过滤掉");
                                }
                            });
                        }catch(e){
                            importFailed();
                        }
                    });
                    break;
                case "xls":
                    // xls 格式主要用于gengo翻译平台中的多语言翻译文件
                    try{
                        var file = J.readFile(req.files.file.path);
                        var str1 = J.utils.to_json(file);
                        var str2 = _.values(str1)[0];
                        var arr =_.map(str2,function(item){
                            return _.map(item,function(value){
                                return value.replace(/^\[\[\[(.+)\]\]\]$/,"$1");
                            })
                        });
                        // 接下来要进行插入操作
                        total_count = arr.length;
                        _.each(arr,function(value){
                            updateI18n(value[0],value[1]);
                        });
                    }catch(e){
                        importFailed();
                    }
                    break;
                case "xml":
                    // 主要用于手机端导入xml
                    fs.readFile(req.files.file.path, function (err, data) {
                        if (err) {
                            throw err;
                        }
                        try{
                            xml2js.parseString(data.toString(), function (err, result) {
                                // 根据一定的格式来取出数据，注意这个是跟进手机端的格式
                                var data = result["resources"]["string"];
                                var obj = {};
                                _.each(data,function(item){
                                    // 不为空
                                    if(item["$"] && item["$"].name.trim()){
                                        if(item["_"] && item["_"].trim()){
                                            total_count += 1;
                                            obj[item["$"].name.trim()] = item["_"].trim();
                                        }else{
                                            log_arr.push("找不到key为" + item["$"].name.trim() + "所对应的值");
                                        }
                                    }else{
                                        log_arr.push("找不到key");
                                    }
                                });
                                // 插入数据
                                _.each(obj,function(value,key){
                                    updateI18n(key,value);
                                });
                            });
                        }catch(e){
                            importFailed();
                        }
                    });
                    break;
            }
        }
    },
    // 导入crowdin zip 包
    importCrowdinZip: function (req, res) {
        var projectName = req.params.name;
        if (req.method == "GET") {
            res.render('web/project/crowdinZip', {
                projectName: projectName
            });
        } else if (req.method == "POST") {
            fs.readFile(req.files.file.path, function (err, data) {
                if (err) {
                    throw err;
                }
                // 先保存zip包
                var zipName = "storage/"+ projectName +"/tmp/airdroid.zip";
                var unzipPath = "storage/"+ projectName +"/tmp";
                fs.writeFile(zipName,data,'utf-8',function(err){
                    if(err) throw err;
                    // 保存成功
                    // 开始解压 zip 包
                    setTimeout(function(){
                        fs.createReadStream(zipName).pipe(unzip.Extract({ path: unzipPath }));
                        renderSuccess(res,projectName,"上传成功");
                    },1000);
                });
            })
        }
    },
    // 设置本地维护语言，即如果上平台了，该语言还是本地维护，不在平台上维护，一般都是简繁体或者英语之类
    // 该设置只针对上平台的项目，没有上平台的项目，其语言都是本地维护
    showLocalLang: function (req, res) {
        var projectName = req.params.name;
        // 如果是本地维护的话，那么该语种的local属性就会为1
        getCollectionList(projectName).find().sort({langcode: 1}).toArray(function (err, list) {
            // 获取本地维护的语言
            // 这边要去掉英语,和已经设置的语言
            res.render('web/project/localLang', {
                projectName: projectName,
                allLang: _.filter(list,function(item){
                    return (item.langcode != "en" && item.local != "1");
                }),
                selectLang:_.filter(list,function(item){
                    return item.local === "1";
                }),
                msg: undefined
            });
        });
    },
    // 添加本地维护语言
    addLocalLang:function(req, res){
        var projectName = req.params.name;
        getCollectionList(projectName).update({"langcode": req.body.langcode}, {'$set': {
            "local": "1"
        }}, function (err, result) {
            if (err) {
                res.send('fail');
            } else {
                res.send('success');
            }
        });
    },
    // 取消本地维护语言
    delLocalLang:function(req, res){
        var projectName = req.params.name;
        var lang = req.body.langcode;
        // 这时候要判断,如果该本地维护语言还存在未审核的语句的话，是不行的
        checkHasUnverifyLocalManientKey(projectName,[lang],function(result){
            if(result){
                // 还不行直接取消
                res.send('该语言还存在未审核的语句，请先去把语句审核完再来取消');
            }else{
                getCollectionList(projectName).update({"langcode": req.body.langcode}, {'$set': {
                    "local": "0"
                }}, function (err, result) {
                    if (err) {
                        res.send('fail');
                    } else {
                        res.send('success');
                        // 同时要把本地维护的语种也给同步
                        getProjectSetting(projectName, function (row) {
                            // 是否有未审核的语言key
                            var localMaintenance = row.LocalMaintenance || {};
                            if(localMaintenance[lang]){
                                delete localMaintenance[lang];
                            }
                            // 最后更新
                            updateLocalMainentKey(projectName, localMaintenance);
                        },null,res);
                    }
                });
            }
        })
    },
    // 操作成功页面
    operateSuccess: function (req, res) {
        var projectName = req.params.name;
        var msg = req.params.msg;
        res.render('web/project/success', {
            projectName: projectName,
            msg: msg
        });
    },
    // 获取文件, 可以在线引用文件, 比如开发的时候，可以引用js文件
    getFile: function(req, res){
        var projectName = req.params.name;
        var fileName = req.params.file;
        var lang = fileName.split(".")[0];
        var ext = fileName.split(".")[1];
        var setNotFound = function(){
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.write("404 Not Found\n");
            res.end();
        };
        // 首先判断有没有该项目
        getProjectSetting(projectName, function (row) {
            // 接下来查找该项目所对应的 语言列表
            // 接下来查找对应的语言
            getCollectionList(projectName).findOne({langcode:lang}, function (err,row) {
                if (err) {
                    console.log(err);
                    setNotFound();
                } else {
                    // 然后查找对应的文件
                    var path = 'storage/' + projectName + '/build/js/' + fileName;
                    fs.exists(path, function(exists) {
                        if(!exists) {
                            // 不存在
                            setNotFound();
                            return;
                        }

                        fs.readFile(path, "binary", function(err, file) {
                            if(err) {
                                res.writeHead(500, {"Content-Type": "text/plain"});
                                res.write(err + "\n");
                                res.end();
                                return;
                            }
                            switch (ext){
                                case "js":
                                    res.writeHead(200, {"Content-Type": "application/javascript"});
                                    break;
                                default :
                                    res.writeHead(200);
                                    break;
                            }
                            res.write(file, "binary");
                            res.end();
                        });
                    });
                }
            });
        },function(err){
            console.log(err);
            setNotFound();
        });
    },
    // 将翻译的zip下载到本地来
    downloadLocalTranslation: function(req, res) {
        var projectName = req.params.name;
        var fileName = 'storage/'+ projectName +'/tmp/airdroid.zip';
        res.download(fileName);
    },
    //检查翻译情况, 本地检查
    checkLocalTranslation: function (req, res) {
        var projectName = req.params.name;
        //检查翻译情况的判断条件
        //看i18n 是否有该值
        var lost_arr = {};
        var result_arr = {};
        var total = 0, itemI18nObj, itemValue, langcode, lostLength;
        //获取默认语言英文
        getProjectSetting(projectName, function (row) {
            // 循环遍历语言
            getCollectionLang(projectName).find().toArray(function (err, enLang) {
                if (err) {
                    throw err;
                }
                total = enLang.length;
                //从list 获取全部的语言列表
                getCollectionList(projectName).find().toArray(function (err, allLanglist) {
                    var langlistArr = [];
                    // 一个一个检查过去
                    _.each(allLanglist,function(langItem){
                        // 去掉英语
                        if(langItem.langcode != "en"){
                            langlistArr.push(langItem);
                            lost_arr[langItem.langcode] = [];
                        }
                    });
                    // 开始遍历 enLang
                    _.each(enLang,function(item){
                        // 开始匹配i18n 里面的值， 为空代表没有翻译
                        itemI18nObj = item.i18n || {};
                        itemValue = item.value;
                        _.each(langlistArr,function(langItem){
                            langcode = langItem.langcode;
                            if(!itemI18nObj[langcode]){
                                // 不存在，就添加
                                lost_arr[langcode].push(item.key);
                            }
                        })
                    });
                    _.each(lost_arr,function(resultItem,code){
                        result_arr[code] = {};
                        lostLength = resultItem.length;
                        result_arr[code].lost = lostLength;
                        result_arr[code].lang = code;
                        // 翻译完成度
                        result_arr[code].percent = parseFloat(((total - lostLength)/total).toFixed(4)) * 100 + "%"
                    });
                    // 最后返回结果
                    res.render('web/project/checkLocalTranslation', {
                        projectName: projectName,
                        lostArr: lost_arr,
                        resultArr: result_arr
                    });
                });
            });
        },null, res);
    },
    //========================= 接下来是 crowdin 平台 api 操作====================
    // 下载翻译结果（到项目中）
    downloadTranslation: function (req, res) {
        var projectName = req.params.name;
        var fileName = 'storage/'+ projectName +'/tmp/airdroid.zip';
        api.download(fileName, function (body) {
            fs.createReadStream(fileName).pipe(unzip.Extract({ path: "storage/"+ projectName +"/tmp" })).on('finish',function () {
                // 解压成功
                res.render('web/project/downloadTranslation', {
                    projectName: projectName
                });
            }).on('error', function (e) {
                console.log(e);
                renderSuccess(res,projectName,"下载的时候，发生错误");
            });
        });
    },
    // 请求crowdin生成最新翻译结果
    refreshTranslation :function (req, res) {
        var projectName = req.params.name;
        api.export_api(function (body) {
            return renderSuccess(res,projectName,"生成最新翻译结果成功，你可以返回首页下载最新的翻译结果");
        });
    },
    // 上传翻译文件到平台
    uploadTranslation: function (req, res) {
        var projectName = req.params.name;
        if (req.method == "GET") {
            getCollectionList(projectName).find().sort({langcode: 1}).toArray(function (err, list) {
                // 获取多语言
                res.render('web/project/uploadTranslation', {
                    projectName: projectName,
                    allLang: _.filter(list,function(item){
                        return (item.langcode != "en");
                    })
                });
            });
        } else if (req.method == "POST") {
            var ext = req.body["ext"];
            // 判断要导入的语言
            var langcode = req.body["langcode"];
            getProjectSetting(projectName, function (row) {
                // 获取在crowdin上面的文件名
                var packageName = row.package + ".csv";
                switch(ext){
                    case "csv":
                        fs.readFile(req.files.file.path, function (err, data) {
                            if (err) {
                                throw err;
                            }
                            api.upload_translation(packageName,langcode,req.files.file.path,function(lang,status){
                                if(status == 200){
                                    var str = "上传翻译成功,语言为：" + lang;
                                }else{
                                    var str = "上传翻译失败,文件找不到，语言为：" + lang;
                                }
                                renderSuccess(res,projectName,str);
                            })
                        });
                        break;
                }
            }, null, res);
        }
    }
};

// 语言的key操作
exports.lang = {
    //显示一种语言的词条列表
    show : function (req, res) {
        var lang = req.params.lang;
        // 获取项目名称
        var projectName = req.params.name;
        var action = req.query["action"];
        var query = {};
        if(action){
            switch(action){
                case "1":
                    // 检查上平台是否有中文
                    break;
                case "2":
                    // 只看空 value (en的空value)
                    query["value"] = '';
                    break;
                case "3":
                    // 只看空 context
                    query["context"] = '';
                    break;
                case "4":
                    // 只看空 value (i18n 中该语种的空value)
                    break;
                case "5":
                    // 查看本地维护语句，并且是英语修改之后，还没有审核的语句
                    break;
            }
        }

        getProjectSetting(projectName, function (row) {
            // 是否上平台
            var crowdin = row.crowdin || "0";
            var owner = row.owner;
            // 是否有未审核的语言key
            var localMaintenance = row.LocalMaintenance || {};
            var localMaintenance_lang = localMaintenance[lang] || [];
            // 判断是否是本地维护的语言
            getCollectionList(projectName).findOne({"langcode":lang},function (err, result) {
                if (err) {
                    throw err;
                }else{
                    if(result){
                        // 是否是本地维护的语言
                        var local = result.local || "0";
                        getCollectionLang(projectName).find(query).sort({key: 1}).toArray(function (err, data) {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log("get " + lang + " lang list");
                                // 这时候判断是否过滤中文
                                if(action == "1"){
                                    var newData = [];
                                    _.each(data,function(item){
                                        if(/[\u4E00-\u9FA5]/i.test(item.value) || /[\u4E00-\u9FA5]/i.test(item.context)){
                                            newData.push(item);
                                        }
                                    });
                                    data = newData;
                                }else if(action == '4'){
                                    // 检查i18n该语言是否为空
                                    var newData = [];
                                    _.each(data,function(item){
                                        if(!item.i18n || !item.i18n[lang]){
                                            newData.push(item);
                                        }
                                    });
                                    data = newData;
                                }else if(action == '5'){
                                    var newData = [];
                                    _.each(data,function(item){
                                        if(_.indexOf(localMaintenance_lang, item.key) > -1){
                                            newData.push(item);
                                        }
                                    });
                                    data = newData;
                                }
                                res.render("web/lang/show", {
                                    name: projectName,
                                    list: data,
                                    lang: lang,
                                    crowdin: crowdin,
                                    local: local,
                                    owner: owner,
                                    localMaintenance: localMaintenance_lang
                                });
                            }
                        });
                    }else{
                        renderSuccess(res,projectName,"不存在该语言");
                    }
                }
            });
        },null, res);
    },
    //删除词条
    delete : function (req, res) {
        var projectName = req.params.name;
        var lang = req.params.lang;
        var id = req.params.id;
        // 如果删除的是英文，那么整条都删掉
        // 如果是非英语语言，那么不整条删除，而是变成内容变成默认的，也就是英语
        if(lang === "en"){
            getCollectionLang(projectName).findOne({"_id": db.ObjectID.createFromHexString(id)}, function (err, row) {
                if(err){
                    throw err;
                }else{
                    // 这时候要同步本地维护语言的未审核数组
                    getLocalMainentLangList(projectName,function(list){
                        verifyLocalManient(projectName, _.map(list,function(langItem){
                            return langItem.langcode;
                        }),[row.key]);
                    });
                    getCollectionLang(projectName).remove({"_id": db.ObjectID.createFromHexString(id)}, function (err, result) {
                        if (err) throw err;
                        console.log("delete success，" + result);
                        res.redirect('web/project/'+ projectName + "/list/" + lang);
                    });
                }
            });
        }else {

        }
    },
    // 增加 key
    add : function (req, res) {
        // 获取项目名称
        var projectName = req.params.name;
        if (req.method == "GET") {
            res.render('web/lang/add', {
                name: projectName,
                msg: undefined
            });
        } else if (req.method == "POST") {
            var key = req.body["key"];
            var value = req.body["value"];
            var des = req.body["des"];
            // 插入数据，并且不能重复
            insertSingleLang(projectName,{
                insertObj: {
                    key: key,
                    value: value,
                    des: des
                },
                insertSuccessCb: function(){
                    res.render('web/lang/add', {
                        name: projectName,
                        msg: "添加成功",
                        state: '1'
                    });
                },
                filterObj: {
                    "key": key
                },
                filterCb: function(){
                    res.render('web/lang/add', {
                        name: projectName,
                        msg: "已存在该key，添加失败",
                        state: '0'
                    });
                }
            });
        }
    },
    // 批量导入key
    multiAdd: function (req, res) {
        // 获取项目名称
        var projectName = req.params.name;
        if (req.method == "GET") {
            res.render('web/lang/multiAdd', {
                name: projectName,
                msg: undefined
            });
        } else if (req.method == "POST") {
            var keyStr = req.body["keyStr"];
            try{
                var keyObj_new = {};
                var getNewKeyObj = function(obj,pre){
                    _.each(obj,function(item,key){
                        if(_.isObject(item)){
                            getNewKeyObj(item,key);
                        }else{
                            keyObj_new[pre ? [pre,key].join(".") : key] = item;
                        }
                    });
                };
                getNewKeyObj(JSON.parse(keyStr));
                var keyLength = _.keys(keyObj_new).length;
                var count = 0;
                // 插入词条的操作
                var insertKey = function(key, value){
                    getCollectionLang(projectName).insert(getLangItem({
                        key: key,
                        value: value,
                        des: ""
                    }), function (err, data) {
                        if (err) throw err;
                        count += 1;
                        if(count >= keyLength){
                            // 全部插入，就返回
                            res.render('web/lang/multiAdd', {
                                name: projectName,
                                msg: "批量添加成功"
                            });
                        }
                    });
                };
                // 接下来就是插入数据
                _.each(keyObj_new,function(item,key){
                    insertKey(key,item);
                })
            }catch(e){
                res.render('web/lang/multiAdd', {
                    name: projectName,
                    msg: "批量添加失败，格式错误"
                });
            }
        }
    },
    // 修改语言的key,但是其他的词条不变
    editKey: function(req, res){
        // 获取项目名称
        var projectName = req.params.name;
        if (req.method == "GET") {
            getProjectSetting(projectName, function (row) {
                // 是否上平台
                var crowdin = row.crowdin;
                var owner = row.owner;
                getCollectionLang(projectName).find().toArray(function (err, data) {
                    if (err) {
                        console.log(err);
                    } else {
                        res.render("web/lang/editKey", {
                            name: projectName,
                            list: data,
                            crowdin: crowdin,
                            owner: owner
                        });
                    }
                });
            },null,res);
        } else if (req.method == "POST") {
            var key = req.body["key"];
            var id = req.body["id"];
            getCollectionLang(projectName).findOne({"_id": db.ObjectID.createFromHexString(id)}, function (err, row) {
                row.i18n = row.i18n || {};
                var oldKey = row.key;
                row.key = key;
                // 同时更新本地维护语言中的key
                // 获取本地维护语言
                getLocalMainentLangList(projectName,function(list){
                    var langArr = _.map(list,function(langItem){
                        return langItem.langcode;
                    });
                    getProjectSetting(projectName, function (row) {
                        if(row.crowdin == '1'){
                            // 这时候要判断该语言是否含有该key的未审核语句
                            var localMaintenance = row.LocalMaintenance || {};
                            _.each(langArr,function(item){
                                if(localMaintenance[item] && _.isArray(localMaintenance[item])){
                                    // 先判断是否含有旧key
                                    if(_.indexOf(localMaintenance[item],oldKey) > -1){
                                        // 先去掉旧key，再添加上新key
                                        localMaintenance[item] = _.without(localMaintenance[item], oldKey);
                                        localMaintenance[item].push(key);
                                    }
                                }
                            });
                            // 最后更新
                            updateLocalMainentKey(projectName, localMaintenance);
                        }
                    });
                });
                // 最后更新
                getCollectionLang(projectName).update({"_id": db.ObjectID.createFromHexString(id)},  row, function (err, result) {
                    if (err) throw err;
                    res.send('success');
                });
            });
        }
    },
    // 审核一条本地维护语言的key
    verify: function (req, res) {
        var lang = req.params.lang;
        var projectName = req.params.name;
        var key = req.body.key;
        verifyLocalManient(projectName,[lang],[key],function(){
            res.send('success');
        })
    },
    //更新词条
    update : function (req, res) {
        var id = req.params.id;
        var lang = req.params.lang;
        var projectName = req.params.name;
        var type = req.body.type;
        var content = req.body.content;
        var key = req.body.key;
        var obj = {};
        // 如果是英语，直接改key
        if(lang === 'en'){
            obj[type] = content;
            // 这时候要判断有没有上平台，如果没有上平台的话，那么就不清空i18n的词条
            // 如果上平台的话，就清空，要改只能去平台上面改
            getProjectSetting(projectName, function (row) {
                var updateLang = function(){
                    getCollectionLang(projectName).update({"_id": db.ObjectID.createFromHexString(id)}, {'$set': obj}, function (err, result) {
                        if (err) throw err;
                        res.send('success');
                    });
                };
                // 如果有上平台
                if(type == 'value' && row.crowdin == '1'){
                    // 同时还要清除 i18n 里面的词条
                    // 这时候要过滤掉本地维护的语言，不清空
                    obj['i18n'] = {"en": content};
                    // 这时候比较麻烦，先获取i18n 的值
                    getCollectionLang(projectName).findOne({"_id": db.ObjectID.createFromHexString(id)}, function (err, resultObj) {
                        var i18nObj = resultObj.i18n || {};
                        var langcode = "";
                        // 虽然本地维护的语言不变，但是如果在上平台的情况下，是要做一下记录的，不然该语言的负责人是不知道的
                        var localMaintenance = row.LocalMaintenance || {};
                        // 接下来要获取本地维护的语种
                        getLocalMainentLangList(projectName,function(list){
                            var local_i18 ={};
                            _.each(list,function(item){
                                langcode = item.langcode;
                                if(i18nObj[langcode]){
                                    local_i18[langcode] = i18nObj[langcode];
                                }
                                // 添加到该语言的未审核数组中
                                localMaintenance[langcode] = localMaintenance[langcode] || [];
                                if(_.indexOf(localMaintenance[langcode],key) < 0){
                                    // 不存在，就添加进去
                                    localMaintenance[langcode].push(key);
                                }
                            });
                            // 这时候要过滤掉本地维护的语言，不清空
                            obj['i18n'] = _.extend(obj['i18n'],local_i18);
                            // 最后保存未审核的数组
                            updateLocalMainentKey(projectName, localMaintenance);
                            updateLang();
                        });
                    });
                }else{
                    updateLang();
                }
            },null,res);
        }else{
            // 是否是本地维护，未审核的
            var unVerify = req.body.unVerify;
            if(unVerify){
                // 如果是的话，要改成已经审核过的
                verifyLocalManient(projectName,[lang],[key]);
            }
            // 如果是非英语，那么只能修改value这一行，并且只能在i18里面
            getCollectionLang(projectName).findOne({"_id": db.ObjectID.createFromHexString(id)}, function (err, row) {
                row.i18n = row.i18n || {};
                row.i18n[lang] = content;
                // 最后更新
                getCollectionLang(projectName).update({"_id": db.ObjectID.createFromHexString(id)},  row, function (err, result) {
                    if (err) throw err;
                    res.send('success');
                });
            });
        }
    }
};

// 语言列表操作
exports.list = {
    // 增加 一种语言
    add : function (req, res) {
        // 获取项目名称
        var projectName = req.params.name;
        if (req.method == "GET") {
            res.render('web/list/add', {
                msg: undefined,
                name: projectName,
                error: undefined,
                list: airHelper.getAllLangList()
            });
        } else if (req.method == "POST") {
            var name = req.body["name"];
            var langcode = req.body["langcode"];
            var folder = req.body["folder"] || langcode;

            getCollectionList(projectName).findOne({langcode:langcode}, function (err, row) {
                if (err) {
                    console.log(err);
                } else {
                    if(row){
                        // 已经存在该项目，出提示
                        res.render('web/list/add', {
                            msg: "该语种已经存在",
                            name: projectName,
                            error: "1",
                            list: airHelper.getAllLangList()
                        });
                    }else{
                        getCollectionList(projectName).insert({name: name, langcode: langcode, folder: folder}, function (err, data) {
                            if (err) throw err;
                            console.log(data);
                            res.render('web/list/add', {
                                msg: "添加语种成功，为" + name,
                                name: projectName,
                                error: undefined,
                                list: airHelper.getAllLangList()
                            });
                        });
                    }
                }
            });
        }
    },
    //启用的语言列表
    edit : function (req, res) {
        var projectName = req.params.name;
        if (req.method == "GET") {
            getCollectionList(projectName).find().sort({langcode: 1}).toArray(function (err, list) {
                res.render('web/list/edit', {
                    projectName: projectName,
                    allLang: list,
                    msg: undefined
                });
            });
        } else if (req.method == "POST") {
            var id = req.body.id;
            var obj = {
                name: req.body.name,
                langcode: req.body.langcode,
                folder: req.body.folder
            };

            getCollectionList(projectName).update({"_id": db.ObjectID.createFromHexString(id)}, {'$set': obj}, function (err, result) {
                if (err) {
                    res.send('fail');
                } else {
                    res.send('success');
                }
            });
        }
    }
};

//检查翻译情况
exports.checkTranslate = function (req, res) {
  //检查翻译情况的判断条件
  //是否与英文版一样，如果一样，则为未翻译

  var checkLang = function (enLang, allLanglist, i) {
    //获取一种语言
    db.collection(allLanglist[i].langcode).find().toArray(function (err, lang) {
      //找到未添加的词条
      var lostItem = _.reject(enLang, function (enItem) {
        return _.find(lang, function (langItem) {
          return langItem["key"] == enItem["key"]
        })
      });
      //找到未翻译的词条
      var unTranslate = _.filter(enLang, function (enItem) {
        return _.find(lang, function (langItem) {
          return langItem["value"] == enItem["value"]
        })
      });

      console.log(allLanglist[i].langcode + "->未添加 " + lostItem.length + " 条，占比 " + (lostItem.length / enLang.length).toFixed(4) * 100 + "%");
      console.log(allLanglist[i].langcode + "->未翻译 " + unTranslate.length + " 条，占比 " + (unTranslate.length / lang.length).toFixed(4) * 100 + "%");

      i++;
      //继续下一种语言
      if (i < allLanglist.length) {
        checkLang(enLang, allLanglist, i);
      }
    });

  };


  //获取默认语言英文
  db.collection('en').find().toArray(function (err, enList) {
    if (err) throw err;
    //从lang_list 获取全部的语言列表
    db.collection('lang_list').find().toArray(function (err, allLanglist) {
      checkLang(enList, allLanglist, 0);
    });
  });

  res.send('运行中');
};
