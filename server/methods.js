Meteor.methods({
  // A method that returns the current connection's IP address
  getIP() {
    return this.connection.clientAddress;
  },
  // A method that checks whether the user has a valid cookie
  cookieCheck(cookie) {
    if (cookie == null) {
      return false;
    } else {
      return true;
    }
  },
  // A method that returns a table given a tablename
  getTable(tablename) {
    return Instances.findOne({
      tablename: {
        $regex: new RegExp('^' + tablename, 'i'),
      },
    });
  },
  // A method that checks whether a table exists with parameter tablename
  listCookieCheck(instanceid) {
    const table = Instances.findOne({
      _id: instanceid,
    });
    if (table == null) {
      return false;
    } else {
      return true;
    }
  },
  // A method that checks whether the email matches the admin of the supplied tablename
  adminCheck(instanceid) {
    if (Meteor.user()) {
      var user = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    const table = Instances.findOne({
      _id: instanceid,
    });
    if (((user == table.admin) || (table.moderators.indexOf(user) != -1)) && (user && table.admin)) {
      return true;
    } else {
      return false;
    }
  },
  touch(instanceid) {
    Instances.update({ _id: instanceid },
    { $set: { lasttouch: new Date().getTime() - 1000 } }
    );
  },
  sendEmail(to, from, subject, text) {
    check([to, from, subject, text], [String]);

    // Let other method calls from the same client start running,
    // without waiting for the email sending to complete.
    this.unblock();

    Email.send({
      to,
      from,
      subject,
      text,
    });
  },
  // A method that adds an answer to the databases
  answer(instanceid, answer, posterName, email, result, currentURL) {
    let keys = '';
    answer.replace(/<(?:.|\n)*?>/gm, '');
    // Retrieves the current quesetion from the DB (if one exists)
    const quesiton = Questions.findOne({
      _id: currentURL,
    });
    if (quesiton == null) {
      return false;
    } else {
      // Inserts the answer into the answer databse
      Answers.insert({
        text: answer,
        poster: posterName,
        email,
        ip: result,
        instanceid,
        qid: currentURL,
        timeorder: new Date().getTime() - 1000,
      }, (error, id) => {
        // If error, set keys to the error object
        if (error) {
          keys = error.invalidKeys;
        } else {
          // If successful, update lasttouch of the question
          Questions.update({
            _id: currentURL,
          }, {
            $set: {
              lasttouch: new Date().getTime() - 1000,
            },
          }, (error, count, status) => {
            if (error) {
              return false;
            } else {
              Instances.update({
                instanceid,
              }, {
                $set: {
                  lasttouch: new Date().getTime() - 1000,
                },
              }, (error, count, status) => {
                if (error) {
                  keys = error.invalidKeys;
                }
              });
            }
          });
        }
      });
    }
    // Return keys (will be error.invalidKeys object if error exists)
    return keys;
  },
  // A method that adds an instance to the databases
  create(tablename, threshhold, redLength, stale, description, mods, admin, maxQuestion, maxResponse, anonymous, isHidden, author) {
    if (!Meteor.user()) {
      return false;
    }
    let keys;
    if (mods.length > 4) {
      const errors = [
        {
          'name': 'modlength',
        },
      ];
      return errors;
    }
    // Inserts the instance into the instances database
    Instances.insert({
      tablename,
      threshhold,
      new_length: redLength,
      stale_length: stale,
      description,
      moderators: mods,
      /* password: passwordConfirm,*/
      lasttouch: new Date().getTime() - 1000,
      admin,
      max_question: maxQuestion,
      max_response: maxResponse,
      anonymous,
      hidden: isHidden,
      author,
    }, (error, id) => {
      // If error, set keys to the error object
      if (error) {
        keys = error.invalidKeys;
      } else {
        // If successful, add the "starter" question to the questions database
        Questions.insert({
          instanceid: id,
          tablename,
          text: "Welcome to the Q&A tool. Please post on this instance. Vote by clicking on the upvote icon to raise a post's prominence. Reply or share a post on facebook and twitter by clicking on the respective icons.",
          poster: 'the system',
          timeorder: new Date().getTime() - 1000,
          lasttouch: new Date().getTime() - 1000,
          state: 'normal',
          votes: 0,
        }, (error, id) => {
          // If error, set keys to the error object
          if (error) {
            console.log('Second error ' + error);
            keys = error.invalidKeys;
          }
        });
      }
    });
    // If error (keys is defined), return the keys (error.invalidKeys) object
    if (keys) {
      return keys;
    } else {
      // If successful, return the name of the newly created table
      return tablename;
    }
  },
  // Method that unhides every question in a given table
  unhide(instanceid) {
    if (Meteor.user()) {
      var email = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    const instance = Instances.findOne({
      _id: instanceid,
    });
    if (email === instance.admin) {
      // Sets state to normal for every question with tablename table
      Questions.update({
        instanceid,
      }, {
        $set: {
          state: 'normal',
        },
      }, {
        multi: true,
      }, (error, count, status) => {
        if (!error) {
          return true;
        }
      });
    }
  },
  unhideThis(id) {
    if (Meteor.user()) {
      var email = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    const question = Questions.findOne({
      _id: id,
    });
    const table = Instances.findOne({
      _id: question.instanceid,
    });
    if (email !== table.admin) {
      if (table.moderators) {
        if (table.moderators.indexOf(email) == -1) {
          return false;
        }
      }
    }
    Questions.update({
      _id: id,
    }, {
      $set: {
        state: 'normal',
      },
    }, (error, count, status) => {
      if (error) {
        return false;
      }
    });
  },
  addMods(mods, instanceid) {
    if (Meteor.user()) {
      var email = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    let keys;
    const instance = Instances.findOne({
      _id: instanceid,
    });
    if (email === instance.admin) {
      Instances.update({
        _id: instanceid,
      }, {
        $push: {
          moderators: {
            $each: mods,
          },
        },
      }, (error, count, status) => {
        if (error) {
          keys = error.invalidKeys;
        }
      });
    } else {
      return false;
    }
    if (keys) {
      return keys;
    } else {
      return true;
    }
  },
  removeMods(mod, instanceid) {
    if (Meteor.user()) {
      var email = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    const instance = Instances.findOne({
      _id: instanceid,
    });
    if (email === instance.admin) {
      Instances.update({
        _id: instanceid,
      }, {
        $pull: {
          moderators: mod,
        },
      }, (error, count, status) => {
        if (!error) {
          return true;
        }
      });
    } else {
      return false;
    }
    return true;
  },
  // Method that modifies a question
  modify(question, id, instanceid) {
    if (Meteor.user()) {
      var email = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    // Checks whether the user has the proper admin privileges
    const instance = Instances.findOne({
      _id: instanceid,
    });
    if (email || instance.admin) {
      if (email != instance.admin) {
        if (instance.moderators.indexOf(email) == -1) {
          return false;
        }
      }
    } else {
      return false;
    }
    // Updates the question with the proper ID to the new question text
    Questions.update({
      _id: id,
    }, {
      $set: {
        lasttouch: new Date().getTime() - 1000,
        text: question,
      },
    }, (error, count, status) => {
      if (error) {
        return false;
      }
    });
    return true;
  },
  // Method that combines two questions and answers
  combine(question, id1, id2, instanceid) {
    if (Meteor.user()) {
      var email = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    // Checks whether the user has proper admin privileges
    const instance = Instances.findOne({
      _id: instanceid,
    });
    if (email !== instance.admin) {
      if (instance.moderators) {
        if (instance.moderators.indexOf(email) == -1) {
          return false;
        }
      }
    }

    // Updates the text of the FIRST question
    Questions.update({ _id: id1 },
      {
        $set: { lasttouch: new Date().getTime() - 1000, text: question },
      },
      (error, count, status) => {
        if (error) {
          return false;
        } else {
          // Sets the QID of the answers to the second question to the first QID of the first question (combining them)
          Answers.update({
            qid: id2,
          }, {
            $set: {
              qid: id1,
            },
          }, {
            multi: true,
          });

          // Migrate votes
          // 1. Get all the unique votes for both questions
          const votes = Votes.aggregate([
            { $match: { qid: { $in: [id1, id2] } } },
            { $group: { _id: '$ip' } },
          ]);
          // 2. Remove Q1's votes
          Votes.remove({ qid: id1 });
          // 3. Insert unique combined votes
          Array.from(votes).forEach((ip) => {
            Votes.insert({ qid: id1, ip: ip._id, instanceid });
          });
          // 4. Update votes count
          Questions.update({ _id: id1 }, { $set: { votes: votes.length } });
        }
      });
  },
  // Method that adds a new question to the database
  propose(instanceid, tablename, question, posterName, posterEmail, ip) {
    let keys;
    question.replace(/<(?:.|\n)*?>/gm, '');
    // Gets the current table
    const table = Instances.findOne({
      _id: instanceid,
    });
    if (table == null) {
      return false;
    } else {
      // Update the lasttouch of the Instance
      Questions.insert({
        instanceid,
        tablename,
        text: question,
        poster: posterName,
        email: posterEmail,
        ip,
        timeorder: new Date().getTime() - 1000,
        lasttouch: new Date().getTime() - 1000,
        state: 'normal',
        votes: 0,
      }, (error, id) => {
        if (error) {
          // If error, store object in keys variable
          keys = error.invalidKeys;
        } else {
          Instances.update({
            _id: table._id,
          }, {
            $set: {
              lasttouch: new Date().getTime() - 1000,
            },
          }, (error, count, status) => {
            if (error) {
              keys = error.invalidKeys;
            }
          });
        }
      });
      /* Instances.update({
        _id: table._id
      }, {
        $set: {
          lasttouch: new Date().getTime()
        }
      }, function(error, count, status) {
        return {
          error: error
        }
        if(error) {
          // If error, store object in keys variable
          keys = error.invalidKeys;
        } else {
          // If successful, insert question into quesitons DB
          Questions.insert({
            tablename: tablename,
            text: question,
            poster: posterName,
            email: posterEmail,
            ip: ip,
            timeorder: new Date().getTime(),
            lasttouch: new Date().getTime(),
            state: "normal",
            votes: 0
          }, function(error, id) {
            if(error) {
              // If error, store object in keys variable
              keys = error.invalidKeys;
            }
          });
        }
      });*/
    }
    return keys;
  },
  // Method that removes a table from the database
  remove(instanceid) {
    if (Meteor.user()) {
      var email = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    // Ensures that the user has proper admin privileges
    const instance = Instances.findOne({
      _id: instanceid,
    });
    // Removes all questions with the given tablename
    if (email !== instance.admin) {
      return false;
    }
    Questions.remove({
      instanceid,
    }, (error) => {
      if (error) {
        alert(error);
      } else {
        // If successful, removes all answers with the given tablename
        Answers.remove({
          instanceid,
        }, (error) => {
          if (error) {
            alert(error);
          } else {
            // If successful, remove the instance with the given tablename
            Instances.remove({
              _id: instanceid,
            }, (error) => {
              if (error) {
                alert(error);
              } else {
                // If successful, remove all votes with the given tablename
                Votes.remove({
                  instanceid: instanceid,
                }, (error) => {
                  if (error) {
                    alert(error);
                  } else {
                    return true;
                  }
                });
              }
            });
          }
        });
      }
    });
  },
  adminRemove(instanceid) {
    // Ensures that the user has proper admin privileges
    let result;
    let hasAccess = false;
    if (Meteor.user()) {
      var email = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    const table = Instances.findOne({
      _id: instanceid,
    });
    if (email) {
      if (email === table.admin) {
        hasAccess = true;
      } else if (email === process.env.SUPERADMIN_EMAIL) {
        hasAccess = true;
      }
    }
    if (hasAccess) {
      // Removes all of the questions with the given table ID
      Questions.remove({
        instanceid,
      }, (error) => {
        if (error) {
          alert(error);
        } else {
          // If successful, removes all answers with the given tablename
          Answers.remove({
            instanceid,
          }, (error) => {
            if (error) {
              alert(error);
            } else {
              // If successful, remove the instance with the given tablename
              Instances.remove({
                _id: instanceid,
              }, (error) => {
                if (error) {
                  alert(error);
                } else {
                  // If successful, remove all votes with the given tablename
                  Votes.remove({
                    tablename: table.tablename,
                  }, (error) => {
                    if (error) {
                      alert(error);
                    } else {
                      result = true;
                    }
                  });
                }
              });
            }
          });
        }
      });
    } else {
      result = false;
    }
    return result;
  },
  rename(id, name, desc) {
    if (Meteor.user()) {
      var email = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    let result;
    const originalInstance = Instances.findOne({
      _id: id,
    });
    let hasAccess = false;
    const originalName = originalInstance.tablename;
    if (email && (email === originalInstance.admin || email === process.env.SUPERADMIN_EMAIL)) {
      hasAccess = true;
    }
    if (hasAccess) {
      Instances.update({
        _id: id,
      }, {
        $set: {
          tablename: name,
          description: desc,
        },
      }, (error, count, status) => {
        if (!error) {
          Questions.update({
            instanceid: id,
          }, {
            $set: {
              tablename: name,
            },
          }, {
            multi: true,
          });
        }
      });
    } else {
      return 2;
    }
  },
  // Method that registers a vote on a question
  vote(questionid, instanceid) {
    let keys = '';
    const ip = this.connection.clientAddress;
    // Ensures that the user hasn't already voted from their IP address
    const votes = Votes.find({
      qid: questionid,
      ip,
    });
    if (votes.fetch().length == 0) {
      // If they haven't voted, increment the given quesiton's vote # by 1 and update the lasttouch
      Questions.update({
        _id: questionid,
      }, {
        $set: {
          lasttouch: new Date().getTime() - 1000,
        },
        $inc: {
          votes: 1,
        },
      }, (error, count, status) => {
        if (error) {
          // If error, set keys to the error object
          keys = error;
        } else {
          // If successful, insert vote into the votes DB
          Votes.insert({
            qid: questionid,
            ip,
            instanceid,
          }, (error, id) => {
            if (error) {
              // If error, set keys to the error object
              keys = error;
            }
          });
        }
      });
    }
    else {
      keys = 'votedbefore';
    }
    return keys;
  },
  // Method that hides (sets state to disabled) a question with given ID
  hide(id) {
    if (Meteor.user()) {
      var email = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    const question = Questions.findOne({
      _id: id,
    });
    const table = Instances.findOne({
      _id: question.instanceid,
    });
    if (email !== table.admin) {
      if (table.moderators) {
        if (table.moderators.indexOf(email) == -1) {
          return false;
        }
      }
    }
    Questions.update({
      _id: id,
    }, {
      $set: {
        state: 'disabled',
      },
    }, (error, count, status) => {
      if (error) {
        return false;
      }
    });
  },
  addFavorite(id) {
    if (Meteor.user()) {
      Meteor.users.update({
        _id: Meteor.user()._id,
      }, {
        $push: {
          'profile.favorites': id,
        },
      });
    } else {
      return false;
    }
    return true;
  },
  removeFavorite(id) {
    if (Meteor.user()) {
      Meteor.users.update({
        _id: Meteor.user()._id,
      }, {
        $pull: {
          'profile.favorites': id,
        },
      });
    } else {
      return false;
    }
    return true;
  },
  superadmin() {
    if (Meteor.user()) {
      var email = Meteor.user().emails[0].address;
    } else {
      return false;
    }
    if (email === process.env.SUPERADMIN_EMAIL) {
      return true;
    } else {
      return false;
    }
  },
  register(email, password, profileName) {
    const re = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,253}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,253}[a-zA-Z0-9])?)*$/i;
    if (!email || !profileName) {
      return 1;
    } else if (!re.test(email)) {
      return 2;
    } else if (Meteor.users.findOne({ 'emails.address': email })) {
      return 3;
    } else if (profileName.length > 30) {
      return 4;
    } else if (email.length > 50 || email.length < 7) {
      return 5;
    } else if (password.length > 30 || password.length < 6) {
      return 6;
    } else {
      return Accounts.createUser({
        email,
        password,
        profile: {
          name: profileName,
        },
      });
    }
  },
});
