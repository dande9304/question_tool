Template.home.onCreated(() => {
  Session.set('search', '');
});

Template.home.onRendered(function () {
  // When the template is rendered, set the document title
  document.title = 'Live Question Answer Tool Chooser';
  this.autorun(() => {
    if (Meteor.user()) {
      Meteor.call('superadmin', (error, result) => {
        Session.set('superadmin', result);
      });
    }
  });
});

Template.home.helpers({
  hasFaves(faves) {
    // removing favorites results in a favorites array with empty elements
    // so to make sure there is never an empty "favorites" section, we have to check
    let res = false;
    for (let i = 0; i < faves.length; i++) {
      if (faves[i]) {
        res = true;
        break;
      }
    }
    return res;
  },
  time_format(lasttouch) {
    return moment(lasttouch).fromNow();
  },
  toolAdmin() {
    Meteor.call('admin', Meteor.user().emails[0].address, (error, result) => {
      if (result) {
        Session.set('toolAdmin', true);
      }
    });
    return Session.get('toolAdmin');
  },
  hasToday() {
    const instances = Template.instance().data;
    let greatest = 0;
    for (let i = 0; i < instances.length; i++) {
      if (instances[i].lasttouch > greatest) {
        greatest = instances[i].lasttouch;
      }
    }
    const ht = (greatest > (new Date().getTime() - 86400000));
    return ht;
  },
  hasWeek() {
    const instances = Template.instance().data;
    let hw;
    for (let i = 0; i < instances.length; i++) {
      if (instances[i].lasttouch > (new Date().getTime() - 604800000)) {
        if (instances[i].lasttouch < (new Date().getTime() - 86400000)) {
          return true;
        }
      }
    }
    return false;
  },
  hasMonth() {
    const instances = Template.instance().data;
    let oldest = new Date().getTime();
    for (let i = 0; i < instances.length; i++) {
      if (instances[i].lasttouch < oldest) {
        oldest = instances[i].lasttouch;
      }
    }
    const hm = (oldest > (new Date().getTime() - 2678400000)) && (oldest < (new Date().getTime() - 604800000));
    return hm;
  },
  instanceList() {
    const re = new RegExp(Session.get('search'), 'i');
    if (Session.get('search') == 'all') {
      var instances = Template.instance().data;
    } else {
      var instances = Instances.find({
        '$or': [{
          tablename: {
            $regex: re,
          },
        }, {
          description: {
            $regex: re,
          },
        }, {
          author: {
            $regex: re,
          },
        }],
      }).fetch();
    }
    instances.sort((a, b) => {
      return b.lasttouch - a.lasttouch;
    });
    for (let i = 0; i < instances.length; i++) {
      if (Meteor.user()) {
        if (Meteor.user().profile.favorites) {
          if (Meteor.user().profile.favorites.indexOf(instances[i]._id) != -1) {
            instances[i].isFavorite = true;
          }
        }
        if (instances[i].admin == Meteor.user().emails[0].address) {
          instances[i].isAdmin = true;
        } else if (instances[i].moderators) {
          if (instances[i].moderators.indexOf(Meteor.user().emails[0].address) != -1) {
            instances[i].isMod = true;
          }
        }
      }
      if (instances[i].description.length > 140) {
        instances[i].description = instances[i].description.substring(0, 137) + '...';
      }
      if (instances[i].tablename.length > 15) {
        instances[i].tablename = instances[i].tablename.substring(0, 13) + '...';
      }
      if (!instances[i].author) {
        instances[i].author = 'Anonymous';
      }
      if ((new Date().getTime() - instances[i].lasttouch) <= 86400000) {
        instances[i].today = true;
      } else if ((new Date().getTime() - instances[i].lasttouch) <= 604800000) {
        instances[i].week = true;
      } else if ((new Date().getTime() - instances[i].lasttouch) <= 2678400000) {
        instances[i].month = true;
      }
    }
    if (instances.length < 1) {
      showCreateError('Nothing found.');
    }
    else {
      if (typeof currentError != 'undefined') {
        Blaze.remove(currentError);
      }
    }
    return instances;
  },
});

Template.home.events({
  'click .deletebutton': function (event, template) {
    const check = confirm('Are you sure you would like to delete the instance?');
    if (check) {
      Meteor.call('adminRemove', event.currentTarget.id);
    }
  },
  'click .renamebutton': function (event, template) {
    if (event.currentTarget.children[0].id == 'rename') {
      event.currentTarget.children[0].innerHTML = 'Done';
      event.currentTarget.children[0].id = 'done';
      var tableNode = event.currentTarget.parentNode.parentNode.children[0];
      const tableName = tableNode.children[0].children[0].innerHTML;
      tableNode.children[0].style.display = 'none';
      tableNode.children[1].className = 'visibleinput';
    } else if (event.currentTarget.children[0].id == 'done') {
      var tableNode = event.currentTarget.parentNode.parentNode.children[0];
      tableNode.children[0].style.display = 'inline';
      tableNode.children[1].className = 'hiddeninput';
      Meteor.call('rename', event.currentTarget.id, tableNode.children[1].value, (error, result) => {
        event.currentTarget.children[0].innerHTML = 'Rename';
      });
      event.currentTarget.children[0].id = 'rename';
    }
  },
  // When the submit button is clicked
  'keyup .searchbar': function (event, template) {
    if (event.target.value) {
      Session.set('search', event.target.value);
    } else {
      Session.set('search', '');
    }
    // return Users.find({name: {$regex: re}});
  },
  'click .favoritebutton': function (event, template) {
    event.stopPropagation();
    Meteor.call('addFavorite', event.target.parentElement.id);
  },
  'click .unfavoritebutton': function (event, template) {
    event.stopPropagation();
    Meteor.call('removeFavorite', event.target.parentElement.id);
  },
  'click #navCreate': function (event, template) {
    if (Meteor.user()) {
      var parentNode = document.getElementById('main-wrapper');
      const nextNode = document.getElementById('mwrapper');
      dropDownTemplate = Blaze.render(Template.create, parentNode, nextNode);
      const questionDiv = document.getElementById('toparea');
      if (questionDiv.style.display == 'none' || !questionDiv.style.display) {
        $('#navCreate').html('Close');
        document.getElementById('navCreate').style.backgroundColor = '#ec4f4f';
        $('#toparea').slideDown();
      } else {
        if (typeof currentError != 'undefined') {
          Blaze.remove(currentError);
        }
        $('#navCreate').html('+ Create');
        document.getElementById('navCreate').style.backgroundColor = '#27ae60';
        $('#toparea').slideUp();
        if (typeof dropDownTemplate != 'undefined') {
          Blaze.remove(dropDownTemplate);
        }
      }
      // Router.go('/create');
    } else {
      var parentNode = document.getElementById('nav');
      popoverTemplate = Blaze.render(Template.register, parentNode);
    }
  },
  'click .superadmindeletebutton': function (event, template) {
    const check = confirm('Are you sure you would like to delete the instance?');
    if (check) {
      Meteor.call('adminRemove', event.currentTarget.id);
    }
    event.stopPropagation();
  },
  'click .superadminrenamebutton': function (event, template) {
    const parentNode = document.getElementById('nav');
    const table = Instances.findOne({
      _id: event.currentTarget.id,
    });
    popoverTemplate = Blaze.renderWithData(Template.rename, {
      table,
      isList: false,
    }, parentNode);
    event.stopPropagation();
  },
});


function showCreateError(reason) {
  if (typeof currentError != 'undefined') {
    Blaze.remove(currentError);
  }
  const parentNode = document.getElementById('recent');
  const nextNode = document.getElementById('questionscontainer');
  currentError = Blaze.renderWithData(Template.form_error, reason, parentNode, nextNode);
}
