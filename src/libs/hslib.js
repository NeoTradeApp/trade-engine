(function () {
  const WebSocket = require("ws");
  const pako = require("pako");

  function atob(str) {
    return Buffer.from(str).toString("base64");
  }
  function btoa(b64Encoded) {
    return Buffer.from(b64Encoded, "base64").toString();
  }
  function buf2Long(a) {
    let b = new Uint8Array(a),
      val = 0,
      len = b.length;
    for (let i = 0, j = len - 1; i < len; i++, j--) {
      val += b[j] << (i * 8);
    }
    return val;
  }
  function buf2Float(a, c) {
    let dataView = new DataView(a, c, 4);
    return dataView.getFloat32();
  }
  function buf2String(a) {
    return String.fromCharCode.apply(null, new Uint8Array(a));
  }
  function getFormatDate(a) {
    let date = new Date(a * 1000);
    let formatDate =
      leadingZero(date.getDate()) +
      "/" +
      leadingZero(date.getMonth() + 1) +
      "/" +
      date.getFullYear() +
      " " +
      leadingZero(date.getHours()) +
      ":" +
      leadingZero(date.getMinutes()) +
      ":" +
      leadingZero(date.getSeconds());
    return formatDate;
  }
  function getFormatDate2(c) {
    var a = new Date(1970, 0, 1);
    a.setSeconds(c);
    let formatDate =
      leadingZero(a.getDate()) +
      "/" +
      leadingZero(a.getMonth() + 1) +
      "/" +
      a.getFullYear() +
      " " +
      leadingZero(a.getHours()) +
      ":" +
      leadingZero(a.getMinutes()) +
      ":" +
      leadingZero(a.getSeconds());
    return formatDate;
  }
  function encodeData(a) {
    let compressed = _atos(pako.deflate(a));
    return btoa(compressed);
  }
  function decodeData(a) {
    consoleLog(a);
    let decoded = atob(a);
    return _atos(pako.inflate(decoded));
  }
  function _atos(a) {
    let newarray = [];
    for (let i = 0; i < a.length; i++) {
      newarray.push(String.fromCharCode(a[i]));
    }
    return newarray.join("");
  }
  function leadingZero(a) {
    return a < 10 ? "0" + a.toString() : a.toString();
  }
  function isScripOK(a) {
    let scripsCount = a.split("&").length;
    if (scripsCount > MAX_SCRIPS) {
      consoleError("Maximum scrips allowed per request is " + MAX_SCRIPS);
      return false;
    }
    return true;
  }
  function checkDateFormat(a) {
    return new RegExp(
      "^(0{1}[1-9]|[12][0-9]|3[01])/(0{1}[1-9]|1[012])/20\\d{2}$"
    ).test(a);
  }
  function sendJsonArrResp(a) {
    let jsonArrRes = [];
    jsonArrRes.push(a);
    return JSON.stringify(jsonArrRes);
  }
  function consoleLog(...args) {
    if (DEBUG_FLAG) {
      console.log(...args);
    }
  }
  function consoleError(...args) {
    if (DEBUG_FLAG) {
      console.error(...args);
    }
  }
  function HSDebug(a) {
    if (HSD_Flag) {
      consoleLog(a);
    }
  }
  function HSIDebug(a) {
    if (HSID_Flag) {
      consoleLog(a);
    }
  }
  function enableHsiLog(a) {
    HSID_Flag = a;
  }
  function enableLog(a) {
    HSD_Flag = a;
  }
  var DataType = (function () {
    function a(c, d) {
      this.name = c;
      this.type = d;
    }
    return a;
  })();
  const LIB_VERSION = "3.0.0";
  const isSingleLib = true;
  var isEncyptIn = true;
  var isEncyptOut = false;
  var DEBUG_FLAG = false;
  var HSD_Flag = false;
  var HSID_Flag = false;
  const MAX_SCRIPS = 100;
  const TRASH_VAL = -2147483648;
  var ackNum = 0;
  const FieldTypes = { FLOAT32: 1, LONG: 2, DATE: 3, STRING: 4 };
  const ResponseTypes = { SNAP: 83, UPDATE: 85 };
  const TopicTypes = { SCRIP: "sf", INDEX: "if", DEPTH: "dp" };
  const BinRespStat = { OK: "K", NOT_OK: "N" };
  const STAT = { OK: "Ok", NOT_OK: "NotOk" };
  const Keys = {
    TYPE: "type",
    USER_ID: "user",
    SESSION_ID: "sessionid",
    SCRIPS: "scrips",
    CHANNEL_NUM: "channelnum",
    CHANNEL_NUMS: "channelnums",
    JWT: "jwt",
    REDIS_KEY: "redis",
    STK_PRC: "stkprc",
    HIGH_STK: "highstk",
    LOW_STK: "lowstk",
    OPC_KEY: "key",
    AUTORIZATION: "Authorization",
    SID: "Sid",
    X_ACCESS_TOKEN: "x-access-token",
    SOURCE: "source",
  };
  const ReqTypeValues = {
    CONNECTION: "cn",
    SCRIP_SUBS: "mws",
    SCRIP_UNSUBS: "mwu",
    INDEX_SUBS: "ifs",
    INDEX_UNSUBS: "ifu",
    DEPTH_SUBS: "dps",
    DEPTH_UNSUBS: "dpu",
    CHANNEL_RESUME: "cr",
    CHANNEL_PAUSE: "cp",
    SNAP_MW: "mwsp",
    SNAP_DP: "dpsp",
    SNAP_IF: "ifsp",
    OPC_SUBS: "opc",
    THROTTLING_INTERVAL: "ti",
    STR: "str",
    FORCE_CONNECTION: "fcn",
    LOG: "log",
  };
  const RespTypeValues = {
    CONN: "cn",
    SUBS: "sub",
    UNSUBS: "unsub",
    SNAP: "snap",
    CHANNELR: "cr",
    CHANNELP: "cp",
    OPC: "opc",
  };
  const BinRespTypes = {
    CONNECTION_TYPE: 1,
    THROTTLING_TYPE: 2,
    ACK_TYPE: 3,
    SUBSCRIBE_TYPE: 4,
    UNSUBSCRIBE_TYPE: 5,
    DATA_TYPE: 6,
    CHPAUSE_TYPE: 7,
    CHRESUME_TYPE: 8,
    SNAPSHOT: 9,
    OPC_SUBSCRIBE: 10,
  };
  const RespCodes = {
    SUCCESS: 200,
    CONNECTION_FAILED: 11001,
    CONNECTION_INVALID: 11002,
    SUBSCRIPTION_FAILED: 11011,
    UNSUBSCRIPTION_FAILED: 11012,
    SNAPSHOT_FAILED: 11013,
    CHANNELP_FAILED: 11031,
    CHANNELR_FAILED: 11032,
  };
  const DEPTH_PREFIX = "dp";
  const SCRIP_PREFIX = "sf";
  const INDEX_PREFIX = "if";
  const STRING_INDEX = { NAME: 51, SYMBOL: 52, EXCHG: 53, TSYMBOL: 54 };
  const SCRIP_INDEX = {
    VOLUME: 4,
    LTP: 5,
    CLOSE: 21,
    VWAP: 13,
    MULTIPLIER: 23,
    PRECISION: 24,
    CHANGE: 25,
    PERCHANGE: 26,
    TURNOVER: 27,
  };
  const SCRIP_MAPPING = [];
  SCRIP_MAPPING[0] = new DataType("ftm0", FieldTypes.DATE);
  SCRIP_MAPPING[1] = new DataType("dtm1", FieldTypes.DATE);
  SCRIP_MAPPING[2] = new DataType("fdtm", FieldTypes.DATE);
  SCRIP_MAPPING[3] = new DataType("ltt", FieldTypes.DATE);
  SCRIP_MAPPING[SCRIP_INDEX.VOLUME] = new DataType("v", FieldTypes.LONG);
  SCRIP_MAPPING[SCRIP_INDEX.LTP] = new DataType("ltp", FieldTypes.FLOAT32);
  SCRIP_MAPPING[6] = new DataType("ltq", FieldTypes.LONG);
  SCRIP_MAPPING[7] = new DataType("tbq", FieldTypes.LONG);
  SCRIP_MAPPING[8] = new DataType("tsq", FieldTypes.LONG);
  SCRIP_MAPPING[9] = new DataType("bp", FieldTypes.FLOAT32);
  SCRIP_MAPPING[10] = new DataType("sp", FieldTypes.FLOAT32);
  SCRIP_MAPPING[11] = new DataType("bq", FieldTypes.LONG);
  SCRIP_MAPPING[12] = new DataType("bs", FieldTypes.LONG);
  SCRIP_MAPPING[SCRIP_INDEX.VWAP] = new DataType("ap", FieldTypes.FLOAT32);
  SCRIP_MAPPING[14] = new DataType("lo", FieldTypes.FLOAT32);
  SCRIP_MAPPING[15] = new DataType("h", FieldTypes.FLOAT32);
  SCRIP_MAPPING[16] = new DataType("lcl", FieldTypes.FLOAT32);
  SCRIP_MAPPING[17] = new DataType("ucl", FieldTypes.FLOAT32);
  SCRIP_MAPPING[18] = new DataType("yh", FieldTypes.FLOAT32);
  SCRIP_MAPPING[19] = new DataType("yl", FieldTypes.FLOAT32);
  SCRIP_MAPPING[20] = new DataType("op", FieldTypes.FLOAT32);
  SCRIP_MAPPING[SCRIP_INDEX.CLOSE] = new DataType("c", FieldTypes.FLOAT32);
  SCRIP_MAPPING[22] = new DataType("oi", FieldTypes.LONG);
  SCRIP_MAPPING[SCRIP_INDEX.MULTIPLIER] = new DataType("mul", FieldTypes.LONG);
  SCRIP_MAPPING[SCRIP_INDEX.PRECISION] = new DataType("prec", FieldTypes.LONG);
  SCRIP_MAPPING[SCRIP_INDEX.CHANGE] = new DataType("cng", FieldTypes.FLOAT32);
  SCRIP_MAPPING[SCRIP_INDEX.PERCHANGE] = new DataType("nc", FieldTypes.STRING);
  SCRIP_MAPPING[SCRIP_INDEX.TURNOVER] = new DataType("to", FieldTypes.FLOAT32);
  SCRIP_MAPPING[STRING_INDEX.NAME] = new DataType("name", FieldTypes.STRING);
  SCRIP_MAPPING[STRING_INDEX.SYMBOL] = new DataType("tk", FieldTypes.STRING);
  SCRIP_MAPPING[STRING_INDEX.EXCHG] = new DataType("e", FieldTypes.STRING);
  SCRIP_MAPPING[STRING_INDEX.TSYMBOL] = new DataType("ts", FieldTypes.STRING);
  const INDEX_INDEX = {
    LTP: 2,
    CLOSE: 3,
    CHANGE: 10,
    PERCHANGE: 11,
    MULTIPLIER: 8,
    PRECISION: 9,
  };
  const INDEX_MAPPING = [];
  INDEX_MAPPING[0] = new DataType("ftm0", FieldTypes.DATE);
  INDEX_MAPPING[1] = new DataType("dtm1", FieldTypes.DATE);
  INDEX_MAPPING[INDEX_INDEX.LTP] = new DataType("iv", FieldTypes.FLOAT32);
  INDEX_MAPPING[INDEX_INDEX.CLOSE] = new DataType("ic", FieldTypes.FLOAT32);
  INDEX_MAPPING[4] = new DataType("tvalue", FieldTypes.DATE);
  INDEX_MAPPING[5] = new DataType("highPrice", FieldTypes.FLOAT32);
  INDEX_MAPPING[6] = new DataType("lowPrice", FieldTypes.FLOAT32);
  INDEX_MAPPING[7] = new DataType("openingPrice", FieldTypes.FLOAT32);
  INDEX_MAPPING[INDEX_INDEX.MULTIPLIER] = new DataType("mul", FieldTypes.LONG);
  INDEX_MAPPING[INDEX_INDEX.PRECISION] = new DataType("prec", FieldTypes.LONG);
  INDEX_MAPPING[INDEX_INDEX.CHANGE] = new DataType("cng", FieldTypes.FLOAT32);
  INDEX_MAPPING[INDEX_INDEX.PERCHANGE] = new DataType("nc", FieldTypes.STRING);
  INDEX_MAPPING[STRING_INDEX.NAME] = new DataType("name", FieldTypes.STRING);
  INDEX_MAPPING[STRING_INDEX.SYMBOL] = new DataType("tk", FieldTypes.STRING);
  INDEX_MAPPING[STRING_INDEX.EXCHG] = new DataType("e", FieldTypes.STRING);
  INDEX_MAPPING[STRING_INDEX.TSYMBOL] = new DataType("ts", FieldTypes.STRING);
  const DEPTH_INDEX = { MULTIPLIER: 32, PRECISION: 33 };
  const DEPTH_MAPPING = [];
  DEPTH_MAPPING[0] = new DataType("ftm0", FieldTypes.DATE);
  DEPTH_MAPPING[1] = new DataType("dtm1", FieldTypes.DATE);
  DEPTH_MAPPING[2] = new DataType("bp", FieldTypes.FLOAT32);
  DEPTH_MAPPING[3] = new DataType("bp1", FieldTypes.FLOAT32);
  DEPTH_MAPPING[4] = new DataType("bp2", FieldTypes.FLOAT32);
  DEPTH_MAPPING[5] = new DataType("bp3", FieldTypes.FLOAT32);
  DEPTH_MAPPING[6] = new DataType("bp4", FieldTypes.FLOAT32);
  DEPTH_MAPPING[7] = new DataType("sp", FieldTypes.FLOAT32);
  DEPTH_MAPPING[8] = new DataType("sp1", FieldTypes.FLOAT32);
  DEPTH_MAPPING[9] = new DataType("sp2", FieldTypes.FLOAT32);
  DEPTH_MAPPING[10] = new DataType("sp3", FieldTypes.FLOAT32);
  DEPTH_MAPPING[11] = new DataType("sp4", FieldTypes.FLOAT32);
  DEPTH_MAPPING[12] = new DataType("bq", FieldTypes.LONG);
  DEPTH_MAPPING[13] = new DataType("bq1", FieldTypes.LONG);
  DEPTH_MAPPING[14] = new DataType("bq2", FieldTypes.LONG);
  DEPTH_MAPPING[15] = new DataType("bq3", FieldTypes.LONG);
  DEPTH_MAPPING[16] = new DataType("bq4", FieldTypes.LONG);
  DEPTH_MAPPING[17] = new DataType("bs", FieldTypes.LONG);
  DEPTH_MAPPING[18] = new DataType("bs1", FieldTypes.LONG);
  DEPTH_MAPPING[19] = new DataType("bs2", FieldTypes.LONG);
  DEPTH_MAPPING[20] = new DataType("bs3", FieldTypes.LONG);
  DEPTH_MAPPING[21] = new DataType("bs4", FieldTypes.LONG);
  DEPTH_MAPPING[22] = new DataType("bno1", FieldTypes.LONG);
  DEPTH_MAPPING[23] = new DataType("bno2", FieldTypes.LONG);
  DEPTH_MAPPING[24] = new DataType("bno3", FieldTypes.LONG);
  DEPTH_MAPPING[25] = new DataType("bno4", FieldTypes.LONG);
  DEPTH_MAPPING[26] = new DataType("bno5", FieldTypes.LONG);
  DEPTH_MAPPING[27] = new DataType("sno1", FieldTypes.LONG);
  DEPTH_MAPPING[28] = new DataType("sno2", FieldTypes.LONG);
  DEPTH_MAPPING[29] = new DataType("sno3", FieldTypes.LONG);
  DEPTH_MAPPING[30] = new DataType("sno4", FieldTypes.LONG);
  DEPTH_MAPPING[31] = new DataType("sno5", FieldTypes.LONG);
  DEPTH_MAPPING[DEPTH_INDEX.MULTIPLIER] = new DataType("mul", FieldTypes.LONG);
  DEPTH_MAPPING[DEPTH_INDEX.PRECISION] = new DataType("prec", FieldTypes.LONG);
  DEPTH_MAPPING[STRING_INDEX.NAME] = new DataType("name", FieldTypes.STRING);
  DEPTH_MAPPING[STRING_INDEX.SYMBOL] = new DataType("tk", FieldTypes.STRING);
  DEPTH_MAPPING[STRING_INDEX.EXCHG] = new DataType("e", FieldTypes.STRING);
  DEPTH_MAPPING[STRING_INDEX.TSYMBOL] = new DataType("ts", FieldTypes.STRING);
  var ByteData = (function () {
    function a(c) {
      this.pos = 0;
      this.bytes = new Uint8Array(c);
      this.startOfMsg = 0;
      this.markStartOfMsg = function () {
        this.startOfMsg = this.pos;
        this.pos += 2;
      };
      this.markEndOfMsg = function () {
        let len = this.pos - this.startOfMsg - 2;
        this.bytes[0] = (len >> 8) & 255;
        this.bytes[1] = len & 255;
      };
      this.clear = function () {
        this.pos = 0;
      };
      this.getPosition = function () {
        return this.pos;
      };
      this.getBytes = function () {
        return this.bytes;
      };
      this.appendByte = function (d) {
        this.bytes[this.pos++] = d;
      };
      this.appendByteAtPos = function (e, d) {
        this.bytes[e] = d;
      };
      this.appendChar = function (d) {
        this.bytes[this.pos++] = d;
      };
      this.appendCharAtPos = function (e, d) {
        this.bytes[e] = d;
      };
      this.appendShort = function (d) {
        this.bytes[this.pos++] = (d >> 8) & 255;
        this.bytes[this.pos++] = d & 255;
      };
      this.appendInt = function (d) {
        this.bytes[this.pos++] = (d >> 24) & 255;
        this.bytes[this.pos++] = (d >> 16) & 255;
        this.bytes[this.pos++] = (d >> 8) & 255;
        this.bytes[this.pos++] = d & 255;
      };
      this.appendLong = function (d) {
        this.bytes[this.pos++] = (d >> 56) & 255;
        this.bytes[this.pos++] = (d >> 48) & 255;
        this.bytes[this.pos++] = (d >> 40) & 255;
        this.bytes[this.pos++] = (d >> 32) & 255;
        this.bytes[this.pos++] = (d >> 24) & 255;
        this.bytes[this.pos++] = (d >> 16) & 255;
        this.bytes[this.pos++] = (d >> 8) & 255;
        this.bytes[this.pos++] = d & 255;
      };
      this.appendLongAsBigInt = function (e) {
        const d = BigInt(e);
        this.bytes[this.pos++] = Number((d >> BigInt(56)) & BigInt(255));
        this.bytes[this.pos++] = Number((d >> BigInt(48)) & BigInt(255));
        this.bytes[this.pos++] = Number((d >> BigInt(40)) & BigInt(255));
        this.bytes[this.pos++] = Number((d >> BigInt(32)) & BigInt(255));
        this.bytes[this.pos++] = Number((d >> BigInt(24)) & BigInt(255));
        this.bytes[this.pos++] = Number((d >> BigInt(16)) & BigInt(255));
        this.bytes[this.pos++] = Number((d >> BigInt(8)) & BigInt(255));
        this.bytes[this.pos++] = Number(d & BigInt(255));
      };
      this.appendString = function (d) {
        let strLen = d.length;
        for (let i = 0; i < strLen; i++) {
          this.bytes[this.pos++] = d.charCodeAt(i);
        }
      };
      this.appendByteArr = function (d) {
        let byteLen = d.length;
        for (let i = 0; i < byteLen; i++) {
          this.bytes[this.pos++] = d[i];
        }
      };
      this.appendByteArr = function (e, d) {
        for (let i = 0; i < d; i++) {
          this.bytes[this.pos++] = e[i];
        }
      };
    }
    return a;
  })();
  function getAcknowledgementReq(a) {
    let buffer = new ByteData(11);
    buffer.markStartOfMsg();
    buffer.appendByte(BinRespTypes.ACK_TYPE);
    buffer.appendByte(1);
    buffer.appendByte(1);
    buffer.appendShort(4);
    buffer.appendInt(a);
    buffer.markEndOfMsg();
    return buffer.getBytes();
  }
  function prepareConnectionRequest(a) {
    let userIdLen = a.length;
    let src = "JS_API";
    let srcLen = src.length;
    let buffer = new ByteData(userIdLen + srcLen + 10);
    buffer.markStartOfMsg();
    buffer.appendByte(BinRespTypes.CONNECTION_TYPE);
    buffer.appendByte(2);
    buffer.appendByte(1);
    buffer.appendShort(userIdLen);
    buffer.appendString(a);
    buffer.appendByte(2);
    buffer.appendShort(srcLen);
    buffer.appendString(src);
    buffer.markEndOfMsg();
    return buffer.getBytes();
  }
  function prepareConnectionRequest2(a, c) {
    let src = "JS_API";
    let srcLen = src.length;
    let jwtLen = a.length;
    let redisLen = c.length;
    let buffer = new ByteData(srcLen + jwtLen + redisLen + 13);
    buffer.markStartOfMsg();
    buffer.appendByte(BinRespTypes.CONNECTION_TYPE);
    buffer.appendByte(3);
    buffer.appendByte(1);
    buffer.appendShort(jwtLen);
    buffer.appendString(a);
    buffer.appendByte(2);
    buffer.appendShort(redisLen);
    buffer.appendString(c);
    buffer.appendByte(3);
    buffer.appendShort(srcLen);
    buffer.appendString(src);
    buffer.markEndOfMsg();
    return buffer.getBytes();
  }
  function prepareSubsUnSubsRequest(c, d, e, a) {
    if (!isScripOK(c)) {
      return;
    }
    let dataArr = getScripByteArray(c, e);
    let buffer = new ByteData(dataArr.length + 11);
    buffer.markStartOfMsg();
    buffer.appendByte(d);
    buffer.appendByte(2);
    buffer.appendByte(1);
    buffer.appendShort(dataArr.length);
    buffer.appendByteArr(dataArr, dataArr.length);
    buffer.appendByte(2);
    buffer.appendShort(1);
    buffer.appendByte(a);
    buffer.markEndOfMsg();
    return buffer.getBytes();
  }
  function prepareChannelRequest(c, a) {
    let buffer = new ByteData(15);
    buffer.markStartOfMsg();
    buffer.appendByte(c);
    buffer.appendByte(1);
    buffer.appendByte(1);
    buffer.appendShort(8);
    let int1 = 0,
      int2 = 0;
    a.forEach(function (d) {
      if (d > 0 && d <= 32) {
        int1 |= 1 << d;
      } else {
        if (d > 32 && d <= 64) {
          int2 |= 1 << d;
        } else {
          consoleError(
            "Error: Channel values must be in this range  [ val > 0 && val < 65 ]"
          );
        }
      }
    });
    buffer.appendInt(int2);
    buffer.appendInt(int1);
    buffer.markEndOfMsg();
    return buffer.getBytes();
  }
  function prepareSnapshotRequest(a, c, d) {
    if (!isScripOK(a)) {
      return;
    }
    let dataArr = getScripByteArray(a, d);
    let buffer = new ByteData(dataArr.length + 7);
    buffer.markStartOfMsg();
    buffer.appendByte(c);
    buffer.appendByte(1);
    buffer.appendByte(1);
    buffer.appendShort(dataArr.length);
    buffer.appendByteArr(dataArr, dataArr.length);
    buffer.markEndOfMsg();
    return buffer.getBytes();
  }
  function prepareThrottlingIntervalRequest(a) {
    let buffer = new ByteData(11);
    buffer.markStartOfMsg();
    buffer.appendByte(BinRespTypes.THROTTLING_TYPE);
    buffer.appendByte(1);
    buffer.appendByte(1);
    buffer.appendShort(4);
    buffer.appendInt(a);
    buffer.markEndOfMsg();
    return buffer.getBytes();
  }
  function getScripByteArray(c, a) {
    if (c.charCodeAt[c.length - 1] == "&") {
      c = c.substring(0, c.length - 1);
    }
    let scripArray = c.split("&");
    let scripsCount = scripArray.length;
    let dataLen = 0;
    for (let index = 0; index < scripsCount; index++) {
      scripArray[index] = a + "|" + scripArray[index];
      dataLen += scripArray[index].length + 1;
    }
    let bytes = new Uint8Array(dataLen + 2);
    let pos = 0;
    bytes[pos++] = (scripsCount >> 8) & 255;
    bytes[pos++] = scripsCount & 255;
    for (let index = 0; index < scripsCount; index++) {
      let currScrip = scripArray[index];
      let scripLen = currScrip.length;
      bytes[pos++] = scripLen & 255;
      for (strIndex = 0; strIndex < scripLen; strIndex++) {
        bytes[pos++] = currScrip.charCodeAt(strIndex);
      }
    }
    return bytes;
  }
  function getOpChainSubsRequest(d, e, a, c, f) {
    let opcKeyLen = d.length;
    let buffer = new ByteData(opcKeyLen + 30);
    buffer.markStartOfMsg();
    buffer.appendByte(BinRespTypes.OPC_SUBSCRIBE);
    buffer.appendByte(5);
    buffer.appendByte(1);
    buffer.appendShort(opcKeyLen);
    buffer.appendString(d);
    buffer.appendByte(2);
    buffer.appendShort(8);
    buffer.appendLongAsBigInt(e);
    buffer.appendByte(3);
    buffer.appendShort(1);
    buffer.appendByte(a);
    buffer.appendByte(4);
    buffer.appendShort(1);
    buffer.appendByte(c);
    buffer.appendByte(5);
    buffer.appendShort(1);
    buffer.appendByte(f);
    buffer.markEndOfMsg();
    return buffer.getBytes();
  }
  var topicList = {};
  var counter = 0;
  var HSWrapper = (function () {
    function a() {
      this.parseData = function (e) {
        let pos = 0;
        let packetsCount = buf2Long(e.slice(pos, 2));
        HSDebug("packets.length: " + packetsCount);
        pos += 2;
        let type = buf2Long(e.slice(pos, pos + 1));
        pos += 1;
        HSDebug("TYPE:: " + type);
        if (type == BinRespTypes.CONNECTION_TYPE) {
          let jsonRes = {};
          let fCount = buf2Long(e.slice(pos, pos + 1));
          pos += 1;
          if (fCount >= 2) {
            let fid1 = buf2Long(e.slice(pos, pos + 1));
            pos += 1;
            let valLen = buf2Long(e.slice(pos, pos + 2));
            pos += 2;
            let status = buf2String(e.slice(pos, pos + valLen));
            pos += valLen;
            fid1 = buf2Long(e.slice(pos, pos + 1));
            pos += 1;
            valLen = buf2Long(e.slice(pos, pos + 2));
            pos += 2;
            let ackCount = buf2Long(e.slice(pos, pos + valLen));
            switch (status) {
              case BinRespStat.OK:
                jsonRes.stat = STAT.OK;
                jsonRes.type = RespTypeValues.CONN;
                jsonRes.msg = "successful";
                jsonRes.stCode = RespCodes.SUCCESS;
                break;
              case BinRespStat.NOT_OK:
                jsonRes.stat = STAT.NOT_OK;
                jsonRes.type = RespTypeValues.CONN;
                jsonRes.msg = "failed";
                jsonRes.stCode = RespCodes.CONNECTION_FAILED;
                break;
            }
            ackNum = ackCount;
          } else {
            if (fCount == 1) {
              let fid1 = buf2Long(e.slice(pos, pos + 1));
              pos += 1;
              let valLen = buf2Long(e.slice(pos, pos + 2));
              pos += 2;
              let status = buf2String(e.slice(pos, pos + valLen));
              pos += valLen;
              switch (status) {
                case BinRespStat.OK:
                  jsonRes.stat = STAT.OK;
                  jsonRes.type = RespTypeValues.CONN;
                  jsonRes.msg = "successful";
                  jsonRes.stCode = RespCodes.SUCCESS;
                  break;
                case BinRespStat.NOT_OK:
                  jsonRes.stat = STAT.NOT_OK;
                  jsonRes.type = RespTypeValues.CONN;
                  jsonRes.msg = "failed";
                  jsonRes.stCode = RespCodes.CONNECTION_FAILED;
                  break;
              }
            } else {
              jsonRes.stat = STAT.NOT_OK;
              jsonRes.type = RespTypeValues.CONN;
              jsonRes.msg = "invalid field count";
              jsonRes.stCode = RespCodes.CONNECTION_INVALID;
            }
          }
          return sendJsonArrResp(jsonRes);
        } else {
          if (type == BinRespTypes.DATA_TYPE) {
            let msgNum = 0;
            if (ackNum > 0) {
              ++counter;
              msgNum = buf2Long(e.slice(pos, pos + 4));
              pos += 4;
              if (counter == ackNum) {
                let req = getAcknowledgementReq(msgNum);
                if (ws) {
                  ws.send(req);
                }
                HSDebug("Acknowledgement sent for message num: " + msgNum);
                counter = 0;
              }
            }
            var h = [];
            var g = buf2Long(e.slice(pos, pos + 2));
            pos += 2;
            for (let n = 0; n < g; n++) {
              pos += 2;
              var c = buf2Long(e.slice(pos, pos + 1));
              HSDebug("ResponseType: " + c);
              pos++;
              if (c == ResponseTypes.SNAP) {
                let f = buf2Long(e.slice(pos, pos + 4));
                pos += 4;
                HSDebug("topic Id: " + f);
                let nameLen = buf2Long(e.slice(pos, pos + 1));
                pos++;
                HSDebug("nameLen:" + nameLen);
                let topicName = buf2String(e.slice(pos, pos + nameLen));
                pos += nameLen;
                HSDebug("topicName: " + topicName);
                let d = this.getNewTopicData(topicName);
                if (d) {
                  topicList[f] = d;
                  let fcount = buf2Long(e.slice(pos, pos + 1));
                  pos++;
                  HSDebug("fcount1: " + fcount);
                  for (let index = 0; index < fcount; index++) {
                    let fvalue = buf2Long(e.slice(pos, pos + 4));
                    d.setLongValues(index, fvalue);
                    pos += 4;
                    HSDebug(index + ":" + fvalue);
                  }
                  d.setMultiplierAndPrec();
                  fcount = buf2Long(e.slice(pos, pos + 1));
                  pos++;
                  HSDebug("fcount2: " + fcount);
                  for (let index = 0; index < fcount; index++) {
                    let fid = buf2Long(e.slice(pos, pos + 1));
                    pos++;
                    let dataLen = buf2Long(e.slice(pos, pos + 1));
                    pos++;
                    let strVal = buf2String(e.slice(pos, pos + dataLen));
                    pos += dataLen;
                    d.setStringValues(fid, strVal);
                    HSDebug(fid + ":" + strVal);
                  }
                  h.push(d.prepareData());
                } else {
                  HSDebug("Invalid topic feed type !");
                }
              } else {
                if (c == ResponseTypes.UPDATE) {
                  HSDebug("updates ......");
                  var f = buf2Long(e.slice(pos, pos + 4));
                  HSDebug("topic Id: " + f);
                  pos += 4;
                  var d = topicList[f];
                  if (!d) {
                    consoleError("Topic Not Available in TopicList!");
                  } else {
                    let fcount = buf2Long(e.slice(pos, pos + 1));
                    pos++;
                    HSDebug("fcount1: " + fcount);
                    for (let index = 0; index < fcount; index++) {
                      let fvalue = buf2Long(e.slice(pos, pos + 4));
                      d.setLongValues(index, fvalue);
                      HSDebug("index:" + index + ", val:" + fvalue);
                      pos += 4;
                    }
                  }
                  h.push(d.prepareData());
                } else {
                  consoleError("Invalid ResponseType: " + c);
                }
              }
            }
            return JSON.stringify(h);
          } else {
            if (
              type == BinRespTypes.SUBSCRIBE_TYPE ||
              type == BinRespTypes.UNSUBSCRIBE_TYPE
            ) {
              let status = this.getStatus(e, pos);
              let jsonRes = {};
              switch (status) {
                case BinRespStat.OK:
                  jsonRes.stat = STAT.OK;
                  jsonRes.type =
                    type == BinRespTypes.SUBSCRIBE_TYPE
                      ? RespTypeValues.SUBS
                      : RespTypeValues.UNSUBS;
                  jsonRes.msg = "successful";
                  jsonRes.stCode = RespCodes.SUCCESS;
                  break;
                case BinRespStat.NOT_OK:
                  jsonRes.stat = STAT.NOT_OK;
                  if (type == BinRespTypes.SUBSCRIBE_TYPE) {
                    jsonRes.type = RespTypeValues.SUBS;
                    jsonRes.msg = "subscription failed";
                    jsonRes.stCode = RespCodes.SUBSCRIPTION_FAILED;
                  } else {
                    jsonRes.type = RespTypeValues.UNSUBS;
                    jsonRes.msg = "unsubscription  failed";
                    jsonRes.stCode = RespCodes.UNSUBSCRIPTION_FAILED;
                  }
                  break;
              }
              return sendJsonArrResp(jsonRes);
            } else {
              if (type == BinRespTypes.SNAPSHOT) {
                let status = this.getStatus(e, pos);
                let jsonRes = {};
                switch (status) {
                  case BinRespStat.OK:
                    jsonRes.stat = STAT.OK;
                    jsonRes.type = RespTypeValues.SNAP;
                    jsonRes.msg = "successful";
                    jsonRes.stCode = RespCodes.SUCCESS;
                    break;
                  case BinRespStat.NOT_OK:
                    jsonRes.stat = STAT.NOT_OK;
                    jsonRes.type = RespTypeValues.SNAP;
                    jsonRes.msg = "failed";
                    jsonRes.stCode = RespCodes.SNAPSHOT_FAILED;
                    break;
                }
                return sendJsonArrResp(jsonRes);
              } else {
                if (
                  type == BinRespTypes.CHPAUSE_TYPE ||
                  type == BinRespTypes.CHRESUME_TYPE
                ) {
                  let status = this.getStatus(e, pos);
                  let jsonRes = {};
                  switch (status) {
                    case BinRespStat.OK:
                      jsonRes.stat = STAT.OK;
                      jsonRes.type =
                        type == BinRespTypes.CHPAUSE_TYPE
                          ? RespTypeValues.CHANNELP
                          : RespTypeValues.CHANNELR;
                      jsonRes.msg = "successful";
                      jsonRes.stCode = RespCodes.SUCCESS;
                      break;
                    case BinRespStat.NOT_OK:
                      jsonRes.stat = STAT.NOT_OK;
                      jsonRes.type =
                        type == BinRespTypes.CHPAUSE_TYPE
                          ? RespTypeValues.CHANNELP
                          : RespTypeValues.CHANNELR;
                      jsonRes.msg = "failed";
                      jsonRes.stCode =
                        type == BinRespTypes.CHPAUSE_TYPE
                          ? RespCodes.CHANNELP_FAILED
                          : RespCodes.CHANNELR_FAILED;
                      break;
                  }
                  return sendJsonArrResp(jsonRes);
                } else {
                  if (type == BinRespTypes.OPC_SUBSCRIBE) {
                    let status = this.getStatus(e, pos);
                    pos += 5;
                    let jsonRes = {};
                    switch (status) {
                      case BinRespStat.OK:
                        jsonRes.stat = STAT.OK;
                        jsonRes.type = RespTypeValues.OPC;
                        jsonRes.msg = "successful";
                        jsonRes.stCode = RespCodes.SUCCESS;
                        let fld = buf2Long(e.slice(pos, ++pos));
                        let fieldlength = buf2Long(e.slice(pos, pos + 2));
                        pos += 2;
                        let opcKey = buf2String(
                          e.slice(pos, pos + fieldlength)
                        );
                        pos += fieldlength;
                        jsonRes.key = opcKey;
                        fld = buf2Long(e.slice(pos, ++pos));
                        fieldlength = buf2Long(e.slice(pos, pos + 2));
                        pos += 2;
                        let data = buf2String(e.slice(pos, pos + fieldlength));
                        pos += fieldlength;
                        jsonRes.scrips = JSON.parse(data)["data"];
                        break;
                      case BinRespStat.NOT_OK:
                        jsonRes.stat = STAT.NOT_OK;
                        jsonRes.type = RespTypeValues.OPC;
                        jsonRes.msg = "failed";
                        jsonRes.stCode = 11040;
                        break;
                    }
                    return sendJsonArrResp(jsonRes);
                  } else {
                    return null;
                  }
                }
              }
            }
          }
        }
      };
      this.getStatus = function (c, d) {
        let status = BinRespStat.NOT_OK;
        let fieldCount = buf2Long(c.slice(d, ++d));
        if (fieldCount > 0) {
          let fld = buf2Long(c.slice(d, ++d));
          let fieldlength = buf2Long(c.slice(d, d + 2));
          d += 2;
          status = buf2String(c.slice(d, d + fieldlength));
          d += fieldlength;
        }
        return status;
      };
      this.getNewTopicData = function (c) {
        let feedType = c.split("|")[0];
        let topic = null;
        switch (feedType) {
          case TopicTypes.SCRIP:
            topic = new ScripTopicData();
            break;
          case TopicTypes.INDEX:
            topic = new IndexTopicData();
            break;
          case TopicTypes.DEPTH:
            topic = new DepthTopicData();
            break;
        }
        return topic;
      };
    }
    return a;
  })();

  var HSWebSocket = (function () {
    function a(c) {
      userSocket = this;
      userSocket.OPEN = 0;
      userSocket.readyState = 0;
      this.url = c;
      this.open = function () {
        startServer(this.url);
      }
      this.send = function (d) {
        let reqJson = JSON.parse(d);
        HSDebug(reqJson);
        let type = reqJson[Keys.TYPE];
        let req = null;
        let scrips = reqJson[Keys.SCRIPS];
        let channelnum = reqJson[Keys.CHANNEL_NUM];
        switch (type) {
          case ReqTypeValues.CONNECTION:
            if (reqJson[Keys.USER_ID] !== undefined) {
              let user = reqJson[Keys.USER_ID];
              req = prepareConnectionRequest(user);
            } else {
              if (reqJson[Keys.SESSION_ID] !== undefined) {
                let sessionId = reqJson[Keys.SESSION_ID];
                req = prepareConnectionRequest(sessionId);
              } else {
                if (reqJson[Keys.AUTORIZATION] !== undefined) {
                  let jwt = reqJson[Keys.AUTORIZATION];
                  let redisKey = reqJson[Keys.SID];
                  if (jwt && redisKey) {
                    req = prepareConnectionRequest2(jwt, redisKey);
                  } else {
                    consoleError(
                      "Authorization mode is enabled: Authorization or Sid not found !"
                    );
                  }
                } else {
                  consoleError("Invalid conn mode !");
                }
              }
            }
            break;
          case ReqTypeValues.SCRIP_SUBS:
            req = prepareSubsUnSubsRequest(
              scrips,
              BinRespTypes.SUBSCRIBE_TYPE,
              SCRIP_PREFIX,
              channelnum
            );
            break;
          case ReqTypeValues.SCRIP_UNSUBS:
            req = prepareSubsUnSubsRequest(
              scrips,
              BinRespTypes.UNSUBSCRIBE_TYPE,
              SCRIP_PREFIX,
              channelnum
            );
            break;
          case ReqTypeValues.INDEX_SUBS:
            req = prepareSubsUnSubsRequest(
              scrips,
              BinRespTypes.SUBSCRIBE_TYPE,
              INDEX_PREFIX,
              channelnum
            );
            break;
          case ReqTypeValues.INDEX_UNSUBS:
            req = prepareSubsUnSubsRequest(
              scrips,
              BinRespTypes.UNSUBSCRIBE_TYPE,
              INDEX_PREFIX,
              channelnum
            );
            break;
          case ReqTypeValues.DEPTH_SUBS:
            req = prepareSubsUnSubsRequest(
              scrips,
              BinRespTypes.SUBSCRIBE_TYPE,
              DEPTH_PREFIX,
              channelnum
            );
            break;
          case ReqTypeValues.DEPTH_UNSUBS:
            req = prepareSubsUnSubsRequest(
              scrips,
              BinRespTypes.UNSUBSCRIBE_TYPE,
              DEPTH_PREFIX,
              channelnum
            );
            break;
          case ReqTypeValues.CHANNEL_PAUSE:
            channelnum = reqJson[Keys.CHANNEL_NUMS];
            req = prepareChannelRequest(BinRespTypes.CHPAUSE_TYPE, channelnum);
            break;
          case ReqTypeValues.CHANNEL_RESUME:
            channelnum = reqJson[Keys.CHANNEL_NUMS];
            req = prepareChannelRequest(BinRespTypes.CHRESUME_TYPE, channelnum);
            break;
          case ReqTypeValues.SNAP_MW:
            req = prepareSnapshotRequest(
              scrips,
              BinRespTypes.SNAPSHOT,
              SCRIP_PREFIX
            );
            break;
          case ReqTypeValues.SNAP_DP:
            req = prepareSnapshotRequest(
              scrips,
              BinRespTypes.SNAPSHOT,
              DEPTH_PREFIX
            );
            break;
          case ReqTypeValues.SNAP_IF:
            req = prepareSnapshotRequest(
              scrips,
              BinRespTypes.SNAPSHOT,
              INDEX_PREFIX
            );
            break;
          case ReqTypeValues.OPC_SUBS:
            req = getOpChainSubsRequest(
              reqJson[Keys.OPC_KEY],
              reqJson[Keys.STK_PRC],
              reqJson[Keys.HIGH_STK],
              reqJson[Keys.LOW_STK],
              channelnum
            );
            break;
          case ReqTypeValues.THROTTLING_INTERVAL:
            req = prepareThrottlingIntervalRequest(scrips);
            break;
          case ReqTypeValues.LOG:
            enableLog(reqJson.enable);
            break;
          default:
            req = null;
            break;
        }
        if (ws && req) {
          ws.send(req);
        } else {
          consoleError(
            "Unable to send request !, Reason: Connection faulty or request not valid !"
          );
        }
      };
      this.close = function () {
        ws.close();
        userSocket.OPEN = 0;
        userSocket.readyState = 0;
        ws = null;
        hsWrapper = null;
      };
      this.ping = function () {
        ws.ping();
      };
    }
    return a;
  })();

  function startServer(a) {
    ws = new WebSocket(a);
    if (ws) {
      ws.binaryType = "arraybuffer";
      hsWrapper = new HSWrapper();
    } else {
      HSDebug("WebSocket not initialized!");
    }
    ws.onopen = function () {
      userSocket.OPEN = 1;
      userSocket.readyState = 1;
      userSocket.onopen();
    };
    ws.onmessage = function (c) {
      let outData = null;
      let inData = c.data;
      if (inData instanceof ArrayBuffer) {
        let jsonData = hsWrapper.parseData(inData);
        if (jsonData) {
          outData = isEncyptOut ? encodeData(jsonData) : jsonData;
        }
      } else {
        outData = isEncyptIn
          ? isEncyptOut
            ? inData
            : decodeData(inData)
          : isEncyptOut
          ? encodeData(inData)
          : inData;
      }
      HSDebug(outData);
      if (outData) {
        userSocket.onmessage(outData);
      }
    };
    ws.onclose = function () {
      userSocket.onclose();
    };
    ws.onerror = function () {
      userSocket.OPEN = 0;
      userSocket.readyState = 0;
      userSocket.onerror();
    };
    ws.on("pong", function () {
      userSocket.onpong();
    });
  }

  var ScripTopicData = (function () {
    function a() {
      TopicData.call(this, TopicTypes.SCRIP);
      this.setMultiplierAndPrec = function () {
        if (this.updatedFieldsArray[SCRIP_INDEX.PRECISION]) {
          this.precision = this.fieldDataArray[SCRIP_INDEX.PRECISION];
          this.precisionValue = Math.pow(10, this.precision);
        }
        if (this.updatedFieldsArray[SCRIP_INDEX.MULTIPLIER]) {
          this.multiplier = this.fieldDataArray[SCRIP_INDEX.MULTIPLIER];
        }
      };
      this.prepareData = function () {
        this.prepareCommonData();
        if (
          this.updatedFieldsArray[SCRIP_INDEX.LTP] ||
          this.updatedFieldsArray[SCRIP_INDEX.CLOSE]
        ) {
          let ltp = this.fieldDataArray[SCRIP_INDEX.LTP];
          let close = this.fieldDataArray[SCRIP_INDEX.CLOSE];
          if (ltp != undefined && close != undefined) {
            let change = ltp - close;
            this.fieldDataArray[SCRIP_INDEX.CHANGE] = change;
            this.updatedFieldsArray[SCRIP_INDEX.CHANGE] = true;
            this.fieldDataArray[SCRIP_INDEX.PERCHANGE] = (
              (change / close) *
              100
            ).toFixed(this.precision);
            this.updatedFieldsArray[SCRIP_INDEX.PERCHANGE] = true;
          }
        }
        if (
          this.updatedFieldsArray[SCRIP_INDEX.VOLUME] ||
          this.updatedFieldsArray[SCRIP_INDEX.VWAP]
        ) {
          let volume = this.fieldDataArray[SCRIP_INDEX.VOLUME];
          let vwap = this.fieldDataArray[SCRIP_INDEX.VWAP];
          if (volume != undefined && vwap != undefined) {
            this.fieldDataArray[SCRIP_INDEX.TURNOVER] = volume * vwap;
            this.updatedFieldsArray[SCRIP_INDEX.TURNOVER] = true;
          }
        }
        consoleLog(
          "\nScrip::" + this.feedType + "|" + this.exchange + "|" + this.symbol
        );
        let jsonRes = {};
        for (let index = 0; index < SCRIP_MAPPING.length; index++) {
          let dataType = SCRIP_MAPPING[index];
          let val = this.fieldDataArray[index];
          if (this.updatedFieldsArray[index] && val != undefined && dataType) {
            if (dataType.type == FieldTypes.FLOAT32) {
              val = (val / (this.multiplier * this.precisionValue)).toFixed(
                this.precision
              );
            } else {
              if (dataType.type == FieldTypes.DATE) {
                val = getFormatDate(val);
              }
            }
            consoleLog(index + ":" + dataType.name + ":" + val.toString());
            jsonRes[dataType.name] = val.toString();
          }
        }
        this.updatedFieldsArray = [];
        return jsonRes;
      };
    }
    return a;
  })();

  var DepthTopicData = (function () {
    function a() {
      TopicData.call(this, TopicTypes.DEPTH);
      this.setMultiplierAndPrec = function () {
        if (this.updatedFieldsArray[DEPTH_INDEX.PRECISION]) {
          this.precision = this.fieldDataArray[DEPTH_INDEX.PRECISION];
          this.precisionValue = Math.pow(10, this.precision);
        }
        if (this.updatedFieldsArray[DEPTH_INDEX.MULTIPLIER]) {
          this.multiplier = this.fieldDataArray[DEPTH_INDEX.MULTIPLIER];
        }
      };
      this.prepareData = function () {
        this.prepareCommonData();
        consoleLog(
          "\nDepth::" + this.feedType + "|" + this.exchange + "|" + this.symbol
        );
        let jsonRes = {};
        for (var d = 0; d < DEPTH_MAPPING.length; d++) {
          var c = DEPTH_MAPPING[d];
          var e = this.fieldDataArray[d];
          if (this.updatedFieldsArray[d] && e != undefined && c) {
            if (c.type == FieldTypes.FLOAT32) {
              e = (e / (this.multiplier * this.precisionValue)).toFixed(
                this.precision
              );
            } else {
              if (c.type == FieldTypes.DATE) {
                e = getFormatDate(e);
              }
            }
            consoleLog(d + ":" + c.name + ":" + e.toString());
            jsonRes[c.name] = e.toString();
          }
        }
        this.updatedFieldsArray = [];
        return jsonRes;
      };
    }
    return a;
  })();

  var TopicData = (function () {
    function a(c) {
      this.feedType = c;
      this.exchange = null;
      this.symbol = null;
      this.tSymbol = null;
      this.multiplier = 1;
      this.precision = 2;
      this.precisionValue = 100;
      this.jsonArray = null;
      this.fieldDataArray = [];
      this.updatedFieldsArray = [];
      this.fieldDataArray[STRING_INDEX.NAME] = c;
      this.getKey = function () {
        return exchange.concat("|", this.symbol);
      };
      this.setLongValues = function (e, d) {
        if (this.fieldDataArray[e] != d && d != TRASH_VAL) {
          this.fieldDataArray[e] = d;
          this.updatedFieldsArray[e] = true;
        }
      };
      this.clearFieldDataArray = function () {
        this.fieldDataArray.length = this.updatedFieldsArray.length = 0;
      };
      this.setStringValues = function (e, d) {
        switch (e) {
          case STRING_INDEX.SYMBOL:
            this.symbol = d;
            this.fieldDataArray[STRING_INDEX.SYMBOL] = d;
            break;
          case STRING_INDEX.EXCHG:
            this.exchange = d;
            this.fieldDataArray[STRING_INDEX.EXCHG] = d;
            break;
          case STRING_INDEX.TSYMBOL:
            this.tSymbol = d;
            this.fieldDataArray[STRING_INDEX.TSYMBOL] = d;
            this.updatedFieldsArray[STRING_INDEX.TSYMBOL] = true;
            break;
        }
      };
      this.prepareCommonData = function () {
        this.updatedFieldsArray[STRING_INDEX.NAME] = true;
        this.updatedFieldsArray[STRING_INDEX.EXCHG] = true;
        this.updatedFieldsArray[STRING_INDEX.SYMBOL] = true;
      };
    }
    return a;
  })();

  var IndexTopicData = (function () {
    function a() {
      TopicData.call(this, TopicTypes.INDEX);
      this.setMultiplierAndPrec = function () {
        if (this.updatedFieldsArray[INDEX_INDEX.PRECISION]) {
          this.precision = this.fieldDataArray[INDEX_INDEX.PRECISION];
          this.precisionValue = Math.pow(10, this.precision);
        }
        if (this.updatedFieldsArray[INDEX_INDEX.MULTIPLIER]) {
          this.multiplier = this.fieldDataArray[INDEX_INDEX.MULTIPLIER];
        }
      };
      this.prepareData = function () {
        this.prepareCommonData();
        if (
          this.updatedFieldsArray[INDEX_INDEX.LTP] ||
          this.updatedFieldsArray[INDEX_INDEX.CLOSE]
        ) {
          let ltp = this.fieldDataArray[INDEX_INDEX.LTP];
          let close = this.fieldDataArray[INDEX_INDEX.CLOSE];
          if (ltp != undefined && close != undefined) {
            let change = ltp - close;
            this.fieldDataArray[INDEX_INDEX.CHANGE] = change;
            this.updatedFieldsArray[INDEX_INDEX.CHANGE] = true;
            this.fieldDataArray[INDEX_INDEX.PERCHANGE] = (
              (change / close) *
              100
            ).toFixed(this.precision);
            this.updatedFieldsArray[INDEX_INDEX.PERCHANGE] = true;
          }
        }
        consoleLog(
          "\nIndex::" + this.feedType + "|" + this.exchange + "|" + this.symbol
        );
        let jsonRes = {};
        for (let index = 0; index < INDEX_MAPPING.length; index++) {
          let dataType = INDEX_MAPPING[index];
          let val = this.fieldDataArray[index];
          if (this.updatedFieldsArray[index] && val != undefined && dataType) {
            if (dataType.type == FieldTypes.FLOAT32) {
              val = (val / (this.multiplier * this.precisionValue)).toFixed(
                this.precision
              );
            } else {
              if (dataType.type == FieldTypes.DATE) {
                val = getFormatDate(val);
              }
            }
            consoleLog(index + ":" + dataType.name + ":" + val.toString());
            jsonRes[dataType.name] = val.toString();
          }
        }
        this.updatedFieldsArray = [];
        return jsonRes;
      };
    }
    return a;
  })();

  var hsiSocket = null;
  var reqData;
  var hsiWs = null;
  var HSIWebSocket = (function () {
    function a(c) {
      hsiSocket = this;
      hsiSocket.OPEN = 0;
      hsiSocket.readyState = 0;
      this.url = c;
      startHsiServer(this.url);
      this.send = function (d) {
        let reqJson = JSON.parse(d);
        HSIDebug(reqJson);
        let type = reqJson.type;
        let req = null;
        if (type === ReqTypeValues.CONNECTION) {
          if (
            reqJson[Keys.AUTORIZATION] !== undefined &&
            reqJson[Keys.SID] !== undefined &&
            reqJson[Keys.SOURCE] !== undefined
          ) {
            req = {
              type: "cn",
              Authorization: reqJson[Keys.AUTORIZATION],
              Sid: reqJson[Keys.SID],
              src: reqJson[Keys.SOURCE],
            };
            reqData = req;
          } else {
            if (
              reqJson[Keys.X_ACCESS_TOKEN] !== undefined &&
              reqJson[Keys.SOURCE] !== undefined
            ) {
              req = {
                type: "cn",
                "x-access-token": reqJson[Keys.X_ACCESS_TOKEN],
                src: reqJson[Keys.SOURCE],
              };
              reqData = req;
            } else {
              consoleError("Invalid connection mode !");
            }
          }
        } else {
          if (type === ReqTypeValues.FORCE_CONNECTION) {
            reqData = reqData.type = "fcn";
            req = reqData;
          } else {
            if (type === ReqTypeValues.LOG) {
              enableHsiLog(reqJson.enable);
            } else {
              consoleError("Invalid Request !");
            }
          }
        }
        if (hsiWs && req) {
          hsiWs.send(JSON.stringify(req));
        } else {
          consoleError(
            "Unable to send request !, Reason: Connection faulty or request not valid !"
          );
        }
      };
      this.close = function () {
        hsiWs.close();
        hsiSocket.OPEN = 0;
        hsiSocket.readyState = 0;
        hsiWs = null;
      };
    }
    return a;
  })();

  function startHsiServer(a) {
    if ("WebSocket" in window) {
      hsiWs = new WebSocket(a);
    } else {
      if ("MozWebSocket" in window) {
        hsiWs = new MozWebSocket(a);
      } else {
        HSIDebug("WebSocket not supported!");
      }
    }
    if (hsiWs) {
      hsiWs.binaryType = "blob";
    } else {
      HSIDebug("WebSocket not initialized!");
    }
    hsiWs.onopen = function () {
      consoleLog("open");
      hsiSocket.OPEN = 1;
      hsiSocket.readyState = 1;
      hsiSocket.onopen();
    };
    hsiWs.onmessage = function (c) {
      consoleLog(c);
      let data = c.data;
      HSIDebug(data);
      if (data) {
        hsiSocket.onmessage(data);
      }
    };
    hsiWs.onclose = function () {
      hsiSocket.onclose();
    };
    hsiWs.onerror = function () {
      hsiSocket.OPEN = 0;
      hsiSocket.readyState = 0;
      hsiSocket.onerror();
    };
  }

  module.exports = { HSWebSocket, HSIWebSocket };
})();
