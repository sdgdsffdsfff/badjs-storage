/**
 * 内存中实时计算总数
 */

var fs = require("fs");
var path=require("path");

var crypto = require('crypto');

var log4js = require('log4js'),
    logger = log4js.getLogger();

//var MongoClient = require('mongodb').MongoClient;
//
//var mongoDB;
//// Use connect method to connect to the Server
//MongoClient.connect(global.MONGODB.url, function(err, db) {
//    if(err){
//        logger.error("failed connect to mongodb");
//    }else {
//        logger.info("Connected correctly to mongodb");
//    }
//    mongoDB = db;
//});

var getYesterday = function() {
    var date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(0, 0, 0, 0);
    return date;
};

var dateFormat  = function (date , fmt){
    var o = {
        "M+": date.getMonth() + 1, //月份
        "d+": date.getDate(), //日
        "h+": date.getHours(), //小时
        "m+": date.getMinutes(), //分
        "s+": date.getSeconds(), //秒
        "q+": Math.floor((date.getMonth() + 3) / 3), //季度
        "S": date.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

var saveData = {}, currentCacheName = dateFormat(new Date  , "yyyy-MM-dd") ;


(function (){
    var filePath = path.join(__dirname , "..", "cache", "total", currentCacheName )
    if(fs.existsSync(filePath)){
        logger.log("cache is exists , load it , path: " + filePath)
        saveData = JSON.parse(fs.readFileSync(filePath))
    }
}())



var generateErrorMsgTop = function (totalData , startDate , endDate){

    Object.keys(totalData).forEach(function (key , index){
        if(key != "total"){
            var fileName = dateFormat(startDate, "yyyy-MM-dd") + "__" + key;
            var filePath = path.join(__dirname , "..", "cache", "errorMsg", fileName)
            var targetData =  totalData[key];
            var errorMap = targetData.errorMap;
            var errorList = [];
            Object.keys(errorMap).forEach( function (errorMapKey){
                errorList.push({ "_id" :  errorMap[errorMapKey].msg , "total" : errorMap[errorMapKey].total})
            })
            errorList.sort(function (a , b){
                return a.total < b.total ? 1 : -1;
            })

            fs.writeFile(
                filePath ,
                JSON.stringify({"startDate":startDate,"endDate":endDate,"item" :  errorList.slice(0,50) , "pv" : targetData.total })
            )
        }
    })
}

var flushCacheToDisk = function (resetCache , fileName){
    var filePath = path.join(__dirname , "..", "cache", "total", fileName)
    var content = JSON.stringify(saveData);

    if(resetCache){
        var yesterday = getYesterday();
        generateErrorMsgTop(saveData ,  +yesterday , +yesterday + 86400000 -1)
        saveData = {};
    }

    logger.log("flush cache to disk , path : " + filePath );

    fs.writeFile(  filePath  , content )
}
setInterval(function() {
    flushCacheToDisk(false , currentCacheName);
},  60 * 60 *  1000 );


module.exports = {
        increase : function (data){

            var md5 = crypto.createHash("md5").update(data.msg).digest('hex')

            if(!saveData["total"]) {
                saveData["total"] = 0;
            }else {
                ++saveData["total"];
            }

            if(saveData[data.id]){
                saveData[data.id].total++;
            }else {
                saveData[data.id]  = { total :1 , errorMap:{} };
            }

            var errorMap = saveData[data.id].errorMap;
            if( errorMap[md5] ){
                errorMap[md5].total ++;
            }else {
                errorMap[md5] ={total :1 , msg :data.msg+"" }
            }

            var newCacheName = dateFormat(new Date  , "yyyy-MM-dd")
            // not today , flush
            if(currentCacheName != newCacheName){
                flushCacheToDisk(true , currentCacheName);
                logger.log("reset cache  , currentName " + currentCacheName + " newCacheName " + newCacheName  );
                currentCacheName = newCacheName;
            }

            //var count = saveData[data.id];
            //if(count >=1){
            //    count ++;
            //}else {
            //    count = 1;
            //}
            //saveData[data.id] = count;
        },

     /*   getTotal : function (data , cb){
            var findKey = {key : data.key +"-" + data.id};
            mongoDB.collection("total").findOne(findKey , function (err , result){
                if(err){
                    cb(err);
                }else {
                    if(result){
                        cb(null , result.total)
                    }else {
                        cb(null , 0)
                    }
                }
            })
        }*/
}