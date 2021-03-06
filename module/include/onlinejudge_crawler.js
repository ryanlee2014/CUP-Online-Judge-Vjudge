const superagent = require('superagent');
require('superagent-proxy')(superagent);
const cheerio = require('cheerio');
const querystring = require('querystring');
const query = require('./mysql_module');
const functional_module = require('./functional');
const dayjs = require("dayjs");
const functional = new functional_module();
const sleep = functional.sleep;
let proxy = "";
let uva = [];
let agent = superagent.agent();
let upc = superagent.agent();

function checkInteger(integer) {
    if (isNaN(integer)) {
        return -1;
    }
    else {
        return parseInt(integer);
    }
}

module.exports = function (accountArr, config) {
    if (typeof config['proxy'] === "string")
        proxy = config['proxy'];
    const browser = config['browser'];

    function pagent(agent_module) {
        return proxy.length > 4 ? agent_module.proxy(proxy) : agent_module;
    }

    function check_json(text) {
        return /^[\],:{}\s]*$/.test(text.replace(/\\["\\\/bfnrtu]/g, '@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').replace(/(?:^|:|,)(?:\s*\[)+/g, ''))
    }


    function pojcheck(user, id) {
        function parseResult(result) {
            const problem_status = {
                "Pending": 0,
                "Queuing": 0,
                "Compiling": 2,
                "Running": 3,
                "Accepted": 4,
                "Presentation Error": 5,
                "Wrong Answer": 6,
                "Time Limit Exceeded": 7,
                "Memory Limit Exceeded": 8,
                "Output Limit Exceeded": 9,
                "Runtime Error": 10,
                "Compile Error": 11
            };
            if (problem_status[result]) return problem_status[result];
            else {
                for (let index in problem_status) {
                    if (result.indexOf(index) !== -1) {
                        return problem_status[index];
                    }
                }
                return 10;
            }
        }

        return new Promise((resolve) => {
            pagent(superagent.get(`http://poj.org/status?user_id=${user}&top=${id || ""}`))
                .set(browser)
                .end((err, response) => {
                    const $ = cheerio.load(response.text), data = $("table[cellspacing='0'] tr[align=center]"),
                        len = data.length;
                    let next_id;
                    let row = [];
                    //console.log($.text());
                    for (let i = 0; i < len; ++i) {
                        const current = data.eq(i).find("td");
                        let _data = {
                            runner_id: 0,
                            submit_time: null,
                            result: null,
                            problem_id: null,
                            time: null,
                            memory: null,
                            code_length: null,
                            language: null,
                            oj_name: "POJ"
                        };
                        //console.log(current.text());

                        _data.runner_id = current.eq(0).text();
                        _data.submit_time = current.eq(8).text();
                        _data.result = parseResult(current.eq(3).text());
                        _data.problem_id = current.eq(2).text();
                        _data.time = current.eq(5).text();
                        _data.time = _data.time.substring(0, _data.time.indexOf("MS")) || "0";
                        _data.memory = current.eq(4).text();
                        _data.memory = _data.memory.substring(0, _data.memory.indexOf("K")) || "0";
                        _data.code_length = current.eq(7).text();
                        _data.code_length = _data.code_length.substring(0, _data.code_length.indexOf("B"));
                        _data.language = current.eq(6).text();
                        next_id = parseInt(current.eq(0).text());
                        row.push(_data);
                    }
                    resolve({
                        data: row,
                        next: typeof next_id === "number" ? next_id : Boolean(next_id)
                    });
                });
        })
    }

    function upccheck(user, id) {
        function parseResult(result) {
            const problem_status = {
                "等待": 0,
                "等待重判": 1,
                "编译中": 2,
                "运行并评判": 3,
                "正确": 4,
                "格式错误": 5,
                "答案错误": 6,
                "时间超限": 7,
                "内存超限": 8,
                "输出超限": 9,
                "运行错误": 10,
                "编译错误": 11
            };
            if (result.charAt(0) === "*") {
                result = result.substring(1);
            }
            if (problem_status[result]) return problem_status[result];
            else {
                for (let index in problem_status) {
                    if (result.indexOf(index) !== -1) {
                        return problem_status[index];
                    }
                }
                return 10;
            }
        }

        return new Promise((resolve) => {
            hustoj_upc_login().then(() => {
                pagent(upc.get(`http://icpc.upc.edu.cn/status.php?user_id=${user}${id ? `&top=${id}` : ""}`))
                    .set(browser)
                    .end((err, response) => {
                        const $ = cheerio.load(response.text), data = $("#result-tab tr"),
                            len = data.length;
                        let next_id;
                        let row = [];
                        // console.log($.text());
                        for (let i = 1; i < len; ++i) {
                            const current = data.eq(i).find("td");
                            let _data = {
                                runner_id: 0,
                                submit_time: null,
                                result: null,
                                problem_id: null,
                                time: null,
                                memory: null,
                                code_length: null,
                                language: null,
                                oj_name: "HUSTOJ_UPC"
                            };
                            //console.log(current.text());

                            _data.runner_id = current.eq(0).text();
                            _data.submit_time = current.eq(8).text();
                            _data.result = parseResult(current.eq(3).text());
                            _data.problem_id = current.eq(2).text();
                            _data.time = checkInteger(current.eq(5).text());
                            _data.memory = checkInteger(current.eq(4).text());
                            _data.code_length = current.eq(7).text();
                            _data.code_length = checkInteger(_data.code_length.substring(0, _data.code_length.indexOf("B")));
                            _data.language = current.eq(6).text().replace(/\/Edit/, "");
                            next_id = parseInt(current.eq(0).text());
                            row.push(_data);
                        }
                        if (len < 20) {
                            next_id = false;
                        }
                        resolve({
                            data: row,
                            next: typeof next_id === "number" ? next_id : Boolean(next_id)
                        });
                    });
            });

        })
    }

    function vjudgecheck(user, id) {
        function parseResult(result) {
            const problem_status = {
                "AC": 4,
                "PE": 5,
                "WA": 6,
                "TLE": 7,
                "MLE": 8,
                "OLE": 9,
                "RE": 10,
                "CE": 11
            };
            if (problem_status[result]) return problem_status[result];
            else {
                for (let index in problem_status) {
                    if (result.indexOf(index) !== -1) {
                        return problem_status[index];
                    }
                }
                return 10;
            }
        }

        return new Promise((resolve,reject) => {
            try {
                pagent(agent.get(`https://vjudge.net/user/submissions?username=${user}&pageSize=500${id ? `&maxId=${id}` : ""}`)).set(browser)
                    .end((err, response) => {
                        if (err || !response.text) {
                            return;
                        }
                        if (!check_json(response.text)) {
                            return;
                        }
                        const data = JSON.parse(response.text).data;
                        let row = [];
                        let next_id;
                        for (let i of data) {
                            let _data = {
                                runner_id: 0,
                                submit_time: null,
                                result: null,
                                problem_id: null,
                                time: null,
                                memory: null,
                                code_length: null,
                                language: null
                            };
                            _data.runner_id = i[1];
                            _data.submit_time = dayjs(i[9]).format("YYYY-MM-DD HH:mm:ss");
                            _data.result = parseResult(i[4]);
                            _data.problem_id = i[3];
                            _data.oj_name = i[2];
                            _data.time = i[5];
                            _data.memory = i[6];
                            _data.code_length = i[8];
                            _data.language = i[7];
                            next_id = parseInt(i[0]);
                            row.push(_data);
                        }
                        resolve({
                            data: row,
                            next: typeof next_id === "number" ? next_id - 1 : Boolean(next_id)
                        });
                    })
            }
            catch (e) {
                console.log(e);
                console.log(`url:${`https://vjudge.net/user/submissions?username=${user}&pageSize=500${id ? `&maxId=${id}` : ""}`}`);
                reject(e);
            }
        })
    }


    function hducheck(user, id) {
        function parseResult(result) {
            const problem_status = {
                "Pending": 0,
                "Queuing": 0,
                "Compiling": 2,
                "Running": 3,
                "Accepted": 4,
                "Presentation Error": 5,
                "Wrong Answer": 6,
                "Time Limit Exceeded": 7,
                "Memory Limit Exceeded": 8,
                "Output Limit Exceeded": 9,
                "Runtime Error": 10,
                "Compilation Error": 11
            };
            if (problem_status[result]) return problem_status[result];
            else {
                for (let index in problem_status) {
                    if (result.indexOf(index) !== -1) {
                        return problem_status[index];
                    }
                }
                return 10;
            }
        }

        return new Promise((resolve) => {
            pagent(superagent.get(`http://acm.hdu.edu.cn/status.php?${id ? `first=${id}&` : ""}user=${user}&pid=0&lang=0&status=0`))
                .set(browser)
                .end((err, response) => {
                    const $ = cheerio.load(response.text), data = $("table .table_text tr[align=center]"),
                        len = data.length;
                    let next_id;
                    let row = [];
                    for (let i = 0; i < len; ++i) {
                        const current = data.eq(i).find("td");
                        let _data = {
                            runner_id: 0,
                            submit_time: null,
                            result: null,
                            problem_id: null,
                            time: null,
                            memory: null,
                            code_length: null,
                            language: null,
                            oj_name: "HDU"
                        };
                        _data.runner_id = current.eq(0).text();
                        _data.submit_time = current.eq(1).text();
                        _data.result = parseResult(current.eq(2).text());
                        _data.problem_id = current.eq(3).text();
                        _data.time = current.eq(4).text();
                        _data.time = _data.time.substring(0, _data.time.indexOf("MS"));
                        _data.memory = current.eq(5).text();
                        _data.memory = _data.memory.substring(0, _data.memory.indexOf("K"));
                        _data.code_length = current.eq(6).text();
                        _data.code_length = _data.code_length.substring(0, _data.code_length.indexOf("B"));
                        _data.language = current.eq(7).text();
                        next_id = parseInt(current.eq(0).text());
                        row.push(_data);
                    }
                    resolve({
                        data: row,
                        next: typeof next_id === "number" ? next_id - 1 : Boolean(next_id)
                    });
                });
        })
    }

    const save_to_database = async (oj_name, arr) => {
        if (typeof arr === 'undefined' || arr.length === 0) return;
        query("SELECT * FROM vjudge_record WHERE user_id=? and oj_name=?", [accountArr['user_id'], oj_name])
            .then(async (rows) => {
                let list = [];
                for (let i of rows) {
                    list[i.problem_id] = 1;
                }
                for (let i in arr) {
                    if (typeof arr[i] !== "undefined" && arr[i].toString().length > 0 && (typeof list === 'undefined' || typeof list[arr[i]] === 'undefined')) {
                        await query("INSERT INTO vjudge_record(user_id,oj_name,problem_id,time)VALUES(?,?,?,NOW())",
                            [accountArr['user_id'], oj_name, arr[i]]);
                        await sleep(10);
                    }
                }
            });
    };

    const _save_to_database = async (data) => {
        const user_id = accountArr["user_id"];
        if (!data || !data.length) {
            return;
        }
        let original_data;
        try {
            original_data = await query(`select * from vjudge_record where user_id = ?`,[user_id]);
        }
        catch (e) {
            console.log(`original data error`);
            console.log([user_id, data[0].oj_name]);
            return;
        }
        let updateArr = [];
        let insertArr = [];
        for (let row of data) {
            const length = original_data.length;
            let not_insert = false;
            for (let i = 0; i < length; ++i) {
                if (dayjs(new Date(original_data[i].time)).isSame(dayjs(row.submit_time))
                    && original_data[i].user_id === user_id
                    && original_data[i].oj_name.toUpperCase() === row.oj_name.toUpperCase()) {
                    not_insert = true;
                    const prev = original_data[i];
                    const next = row;
                    if (checkInteger(prev.code_length) !== checkInteger(next.code_length)
                        || checkInteger(prev.time_running) !== checkInteger(next.time)
                        || checkInteger(prev.memory) !== checkInteger(next.memory)
                        || checkInteger(prev.result) !== checkInteger(next.result)
                        || prev.language !== next.language) {
                        updateArr.push(next);
                    }
                    break;
                }
            }
            if (!not_insert) {
                insertArr.push(row);
            }
        }
        let errorArr;
        try {
            for (let row of updateArr) {
                errorArr = [checkInteger(row.time), checkInteger(row.memory), checkInteger(row.code_length)
                    , row.result, user_id, row.problem_id
                    , row.submit_time];
                await query(`update vjudge_record set time_running = ?,memory = ?,code_length = ?,result = ?
            where user_id = ? and problem_id = ? and time = ?`,
                    [checkInteger(row.time), checkInteger(row.memory), checkInteger(row.code_length)
                        , row.result, user_id, row.problem_id
                        , row.submit_time])
            }
        }
        catch (e) {
            console.log(`errro in updateArr`);
            console.log(errorArr);
        }
        try {
            for (let row of insertArr) {
                errorArr = [user_id, row.oj_name, row.problem_id, row.submit_time,
                    row.result, checkInteger(row.time), checkInteger(row.memory), checkInteger(row.code_length),
                    row.language];
                await query(`insert into vjudge_record (user_id,oj_name,problem_id,time,result,time_running,memory,code_length,language)
            values(?,?,?,?,?,?,?,?,?)`, [user_id, row.oj_name, row.problem_id, row.submit_time,
                    row.result, checkInteger(row.time), checkInteger(row.memory), checkInteger(row.code_length),
                    row.language])
            }
        }
        catch (e) {
            console.log(`errro in insertArr`);
            console.log(errorArr);
        }
    };


    const hdu_crawler = async (account) => {
        let next_id = undefined;
        let data = [];
        for (; ;) {
            let res = await hducheck(account, next_id);
            next_id = res.next;
            if (res.data.length > 0)
                data.push(...res.data);
            if (!next_id) break;
        }
        _save_to_database(data);
    };


    const poj_crawler = async (account) => {
        let next_id = undefined;
        let data = [];
        for (; ;) {
            let res = await pojcheck(account, next_id);
            next_id = res.next;
            if (res.data.length > 0)
                data.push(...res.data);
            if (!next_id) break;
        }
        _save_to_database(data);
    };

    const upc_crawler = async (account) => {
        let next_id = undefined;
        let data = [];
        for (; ;) {
            let res = await upccheck(account, next_id);
            next_id = res.next;
            if (data.length > 0 && res.data.length > 0 && data[data.length - 1].runner_id === res.data[0].runner_id) {
                res.data.shift();
            }
            if (res.data.length > 0)
                data.push(...res.data);
            if (!next_id) break;
        }
        _save_to_database(data);
    };

    const codeforcesAction = async function (err, response) {
        const convertStatus = function (str) {
            const statusArr = ["wait", "wait", "compiling", "running", "ok", "present", "wrong", "time_limit",
                "memory_limit", "output_limit", "runtime", "compilation"];
            const len = statusArr.length;
            for (let i = 0; i < len; ++i) {
                if (!str || !str.toLowerCase()) {
                    throw new Error("convertStatus str not valid string");
                }
                str = str.toLowerCase();
                if (str.match(statusArr[i])) {
                    return i;
                }
            }
            return 10;
        };
        if (err || !response.ok) {
            console.log("CodeForceAction:Some error occured in response.");
        }
        else {
            try {
                if (!check_json(response.text)) {
                    return;
                }
                const json = JSON.parse(response.text)['result'];
                let arr = [];
                for (let i of json) {
                    let _data = {
                        runner_id: 0,
                        submit_time: null,
                        result: null,
                        problem_id: null,
                        time: null,
                        memory: null,
                        code_length: 0,
                        language: null,
                        oj_name: "CODEFORCES"
                    };
                    _data.result = convertStatus(i.verdict);
                    _data.memory = i.memoryConsumedBytes / 1024;
                    _data.time = i.timeConsumedMillis;
                    _data.language = i.programmingLanguage;
                    _data.problem_id = i.problem.contestId + i.problem.index;
                    _data.submit_time = dayjs(i.creationTimeSeconds * 1000).format("YYYY-MM-DD HH:mm:ss");
                    _data.runner_id = i.id;
                    arr.push(_data);
                }
                _save_to_database(arr);
            }
            catch (e) {
                console.log("Catch error");
                console.log(e);
            }
        }
    };

    const codeforces_crawler = (account) => {
        if (proxy.length > 4)
            superagent.get("http://codeforces.com/api/user.status?handle=" + account + "&from=1&count=100000").set(config['browser']).proxy(proxy).end(codeforcesAction);
        else
            superagent.get("http://codeforces.com/api/user.status?handle=" + account + "&from=1&count=100000").set(config['browser']).end(codeforcesAction);
    };

    const uvaAction = async function (err, response) {
        if (err || !response.ok) {
            console.log("UVAAction:Some error occured in response.");
        }
        else {
            if (!check_json(response.text)) {
                return;
            }
            const json = JSON.parse(response.text)["subs"];
            let arr = [];
            for (let i in json) {
                if (90 === parseInt(json[i][2])) {
                    let problem_id = uva[json[i][1]];
                    arr.push(problem_id);
                }
            }
            save_to_database('UVa', arr);
        }
    };

    const uva_convert_username_to_id = async function (err, response) {
        if (err || !response.ok) {
            console.log("UVA_convert:Some error occured in response.");
        }
        else {
            if (proxy.length > 4)
                superagent.get("https://uhunt.onlinejudge.org/api/subs-user/" + response.text).set(config['browser']).proxy(proxy).end(uvaAction);
            else
                superagent.get("https://uhunt.onlinejudge.org/api/subs-user/" + response.text).set(config['browser']).end(uvaAction);
        }

    };

    const uva_crawler = (account) => {
        if (proxy.length > 4)
            superagent.get("https://uhunt.onlinejudge.org/api/uname2uid/" + account).set(config['browser']).proxy(proxy).end(uva_convert_username_to_id);
        else
            superagent.get("https://uhunt.onlinejudge.org/api/uname2uid/" + account).set(config['browser']).end(uva_convert_username_to_id);

    };


    const vjudge_crawler = async (account) => {
        let us = {
            username: "cupvjudge",
            password: "2016011253"
        };
        await new Promise((resolve) => {
            pagent(agent.post("https://vjudge.net/user/login")).set(browser).send(us).end((err, res) => {
                resolve();
            });
        });
        let next_id = undefined;
        let data = [];
        for (; ;) {
            let res = await vjudgecheck(account, next_id);
            next_id = res.next;
            if (res.data.length > 0)
                data.push(...res.data);
            if (!next_id) break;
        }
        _save_to_database(data);
    };

    const hustoj_upc_login = () => {
        if (!this.upcLogined) {
            const that = this;
            return new Promise((resolve) => {
                pagent(upc.get(`http://exam.upc.edu.cn/csrf.php`)).set(config['browser'])
                    .end((err, response) => {
                        const $ = cheerio.load(response.text);
                        pagent(upc.post(`http://exam.upc.edu.cn/login.php`)).set(config['browser'])
                            .send({
                                user_id: 'cup_sc01',
                                password: '9fcb631dfbfb5deb9469b8c9f7b99d71',
                                csrf: $('input').val()
                            }).end(() => {
                            that.upclogined = true;
                            resolve();
                        })
                    })
            });

        }
        else {
            return new Promise(resolve => resolve());
        }
    };


    const upcvjAction = function (err, response) {
        if (err || !response.ok || !response.text) {
            console.log("UPCVjudgeAction:Some error occured in response.");
        }
        else {
            let json;
            if (check_json(response.text)) {

                json = JSON.parse(response.text)['data']

            } else {
                console.log("UPCVjudgeAction:Some error occured in response.");
                return;
            }
            let hdu = [];
            let hducnt = 0;
            let poj = [];
            let pojcnt = 0;
            for (let i of json) {
                if (i[11] === 'HDU') {
                    hdu.push(i[12]);
                }
                else if (i[11] === 'POJ') {
                    poj.push(i[12]);
                }
            }
            save_to_database('HDU', hdu);
            save_to_database('POJ', poj);
        }
    };

    const upcvj = (account) => {
        const postData = {
            un: account
        };
        const vjurl = "http://exam.upc.edu.cn:8080/vjudge/problem/fetchStatus.action?draw=2&columns%5B0%5D%5Bdata%5D=0&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=false&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=1&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=false&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=2&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=false&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=3&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=false&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=4&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=false&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=5&columns%5B5%5D%5Bname%5D=&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=false&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B6%5D%5Bdata%5D=6&columns%5B6%5D%5Bname%5D=&columns%5B6%5D%5Bsearchable%5D=true&columns%5B6%5D%5Borderable%5D=false&columns%5B6%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B6%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B7%5D%5Bdata%5D=7&columns%5B7%5D%5Bname%5D=&columns%5B7%5D%5Bsearchable%5D=true&columns%5B7%5D%5Borderable%5D=false&columns%5B7%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B7%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B8%5D%5Bdata%5D=8&columns%5B8%5D%5Bname%5D=&columns%5B8%5D%5Bsearchable%5D=true&columns%5B8%5D%5Borderable%5D=false&columns%5B8%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B8%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B9%5D%5Bdata%5D=9&columns%5B9%5D%5Bname%5D=&columns%5B9%5D%5Bsearchable%5D=true&columns%5B9%5D%5Borderable%5D=false&columns%5B9%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B9%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B10%5D%5Bdata%5D=10&columns%5B10%5D%5Bname%5D=&columns%5B10%5D%5Bsearchable%5D=true&columns%5B10%5D%5Borderable%5D=false&columns%5B10%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B10%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B11%5D%5Bdata%5D=11&columns%5B11%5D%5Bname%5D=&columns%5B11%5D%5Bsearchable%5D=true&columns%5B11%5D%5Borderable%5D=false&columns%5B11%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B11%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=desc&start=0&length=1000&search%5Bvalue%5D=&search%5Bregex%5D=false&" + querystring.stringify(postData) + "&OJId=All&probNum=&res=1&language=&orderBy=run_id";
        if (proxy.length > 4)
            superagent.get(vjurl).proxy(proxy).set(config['browser']).end(upcvjAction);
        else
            superagent.get(vjurl).set(config['browser']).end(upcvjAction);
    };

    const crawler_match = {
        "hdu": hdu_crawler,
        "poj": poj_crawler,
        "codeforces": codeforces_crawler,
        "uva": uva_crawler,
        "vjudge": vjudge_crawler,
        "hustoj-upc": upc_crawler,
        "upcvj": function(){}
    };

    const uAction = (err, response) => {
        if (err) return;
        if (!check_json(response.text)) {
            return;
        }
        const res = JSON.parse(response.text);
        for (let i of res) {
            uva[i[0]] = i[1];
        }
    };

    const uva_to = () => {
        if (proxy.length > 4)
            superagent.get("https://uhunt.onlinejudge.org/api/p").set(config['browser']).proxy(proxy).end(uAction);
        else
            superagent.get("https://uhunt.onlinejudge.org/api/p").set(config['browser']).end(uAction);
    };
    const crawler = () => {
        for (const value in accountArr) {
            if (value === 'user_id') continue;
            if (accountArr[value] !== null && typeof crawler_match[value] === "function") {
                crawler_match[value](accountArr[value]);
            }
        }
    };
    this.run = () => {
        uva_to();
        crawler();
    };
};
