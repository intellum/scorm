var moment = require('moment');
var _ = require('lodash');
var Promise = require('bluebird');
var Course = require(`${global.app}/models/course`);

module.exports = Promise.coroutine(function*(userId, courseId, trackingModel, shouldUpdateTotalTime) {
    var updateObject = {};
    
    var currentTime = new Date();

    var courseData = trackingModel._courseData;
    var cmi = courseData.cmi;   

    var cmiCore = cmi.core;

    var cmiSuspendData = JSON.parse(cmi.suspend_data);

    if (!trackingModel._isComplete && (cmiCore.lesson_status === 'passed' || cmiCore.lesson_status === 'completed')) {
        
        updateObject._isComplete = true;
        updateObject._progress = 100;
        updateObject._completedAt = currentTime;
        
        var session = trackingModel._sessions[0];
        
        session._updatedAt = currentTime;
        session._isComplete = true;
        session._progress = 100;
        
        updateObject._sessions = [session];
        
    } else {
        
        updateObject._progress = 50;
        var session = trackingModel._sessions[0];
        
        session._updatedAt = currentTime;
        session._progress = 50;
        
        updateObject._sessions = [session];
        
    }

    // Set assessment attributes
    if (cmiSuspendData._isAssessmentComplete) {
        updateObject._isAssessmentComplete = cmiSuspendData._isAssessmentComplete;
        updateObject._isPassed = cmiSuspendData._isPassed;
        updateObject._assessmentCompletedQuestionsCount = cmiSuspendData._assessmentCompletedQuestionsCount;
        updateObject._assessmentCorrectQuestionsCount = cmiSuspendData._assessmentCorrectQuestionsCount;

        yield Course.findByIdAndUpdate(courseId, {_hasAssessment: true}, {new: true});
    }

    // Set the score
    updateObject._score = _.get(cmiCore, "score.raw");

    if (shouldUpdateTotalTime) {
        // Now update the total time spent for score
        //cmiCore.session_time = '0001:10:25.70';

        var sessionTimeSplit = cmiCore.session_time.split(':');
        var totalTimeSplit = cmiCore.total_time.split(':');

        var sessionTimeHoursToSeconds = parseInt(sessionTimeSplit[0]) * 60 * 60;
        var sessionTimeMinutesToSeconds = parseInt(sessionTimeSplit[1]) * 60;
        var sessionTimeSecondsToSeconds = Number(sessionTimeSplit[2]);
        var totalTimeHoursToSeconds = parseInt(totalTimeSplit[0]) * 60 * 60;
        var totalTimeMinutesToSeconds = parseInt(totalTimeSplit[1]) * 60;
        var totalTimeSecondsToSeconds = Number(totalTimeSplit[2]);

        var sessionTimeInSeconds = sessionTimeHoursToSeconds + sessionTimeMinutesToSeconds + sessionTimeSecondsToSeconds;

        var totalTimeInSeconds = totalTimeHoursToSeconds + totalTimeMinutesToSeconds + totalTimeSecondsToSeconds;

        var totalTime = totalTimeInSeconds + sessionTimeInSeconds;

        var totalTimeAsScormFormat = moment("2015-01-01")
            .startOf('day')
            .milliseconds(totalTime * 1000)
            .format('HHHH:mm:ss.SS');

        // Set total time
        cmiCore.total_time = totalTimeAsScormFormat;
        
        // Reset session_time
        cmiCore.session_time = '0000:00:00.00';

    }

    updateObject._updatedAt = currentTime;

    updateObject._courseData = courseData;

    return updateObject;
    
})