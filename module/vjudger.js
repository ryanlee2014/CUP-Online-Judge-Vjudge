const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
log4js.connectLogger(logger, {level: 'info'});
const UVaJudger_module = require('./uva_judge_module');
const Juder_module = require('./judge_module');

class Vjudge_daemon {
    constructor(config, oj_name) {
        if (oj_name === "uva") {
            this.daemon = new UVaJudger_module(config, oj_name);
            this.daemon.start(config['proxy']);
        }
        else {
            this.daemon = new Juder_module(config, oj_name);
            this.daemon.start(config['proxy']);
        }
    }

}

module.exports = Vjudge_daemon;