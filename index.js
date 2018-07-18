const Fs        = require('fs')
const Path      = require('path')
const Log       = require('./lib/logging');

var GITHUB_TOKEN    = process.env['GITHUB_TOKEN'];
var SLACK_BOT_TOKEN = process.env['SLACK_TOKEN'];

// Validations

if(!GITHUB_TOKEN || GITHUB_TOKEN.length == 0){
  Log.error("GITHUB_TOKEN environment variable is not set")
  process.exit()
}

if(!SLACK_BOT_TOKEN || SLACK_BOT_TOKEN.length == 0){
  Log.error("SLACK_BOT_TOKEN environment variable is not set")
  process.exit()
}

var CONFIG_PATH   = process.env['CONFIG_PATH'] || './';
var regex         = new RegExp(process.env['REPOS_REGEX'] || '.*');
var interval      = parseFloat(process.env['INTERVAL']) || 2;
var organizations = process.env['ORGANIZATIONS'];
var personal      = process.env['PERSONAL'];
var workStart     = process.env['WORK_START'] || 9;
var workEnd       = process.env['WORK_END'] || 17;

personal      = personal && personal.toLowerCase() === 'true' ? true : false;
organizations = organizations && organizations.length > 0 ? organizations.split(',') : [];

try {
  var mappings = JSON.parse(Fs.readFileSync(Path.join(CONFIG_PATH, 'mappings.json')));

}catch(e){
  var mappings = {};
}
// var slackGithubUsersMappings = JSON.parse(Fs.readFileSync(Path.join(CONFIG_PATH, 'mappings.json')));

const Github   = new (require('./lib/github'))({
	token: GITHUB_TOKEN,
	regex: regex,
	organizations: organizations,
	personal: personal
}, Log)

const Slack    = new(require('./lib/slack'))({
	token: SLACK_BOT_TOKEN,
	mappings: mappings //slackGithubUsersMappings
}, Log)

function pollAndNotify(){
    var now = new Date();
    var hours = now.getHours();
    var day = now.getDay();

    Github.getAllPending(function(err, pendings){
        if(err)
            Log.error("Error ", err);
        else{
          // Only execute the poller when it's during working hours
          if (hours >= workStart && hours < workEnd && day != 0 && day != 6 && (hours == 10 || hours == 17)) {
            Object.keys(pendings.pendingUsersRequests).map(function(a){
              Slack.notify_individual(a, pendings.pendingUsersRequests[a], function(err, done){});
            });

            Slack.notify_channels(pendings.pendingPullRequestsUsers,
              function(err, done){});

            setTimeout(pollAndNotify, interval * 60 * 60 * 1000);
          } else {
            Log.info("All work and no play makes Jack a dull boy.")

            // Polls every 15 min to check if we're back in work hours
            setTimeout(pollAndNotify, interval * 60 * 7500);
          }
        }
    });
}

pollAndNotify();
