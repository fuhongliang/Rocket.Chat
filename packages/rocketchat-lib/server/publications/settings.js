Meteor.methods({
	'public-settings/get'(updatedAt) {
		this.unblock();
		const records = RocketChat.models.Settings.find().fetch().filter(function(record) {
			return record.hidden !== true && record['public'] === true;
		});
		if (updatedAt instanceof Date) {
			return {
				update: records.filter(function(record) {
					return record._updatedAt > updatedAt;
				}),
				remove: RocketChat.models.Settings.trashFindDeletedAfter(updatedAt, {
					hidden: {
						$ne: true
					},
					'public': true
				}, {
					fields: {
						_id: 1,
						_deletedAt: 1
					}
				}).fetch()
			};
		}
		return records;
	},
	'private-settings/get'(updatedAt) {
		if (!Meteor.userId()) {
			return [];
		}
		this.unblock();
		if (!RocketChat.authz.hasPermission(Meteor.userId(), 'view-privileged-setting')) {
			return [];
		}
		const records = RocketChat.models.Settings.find().fetch().filter(function(record) {
			return record.hidden !== true;
		});
		if (updatedAt instanceof Date) {
			return {
				update: records.filter(function(record) {
					return record._updatedAt > updatedAt;
				}),
				remove: RocketChat.models.Settings.trashFindDeletedAfter(updatedAt, {
					hidden: {
						$ne: true
					}
				}, {
					fields: {
						_id: 1,
						_deletedAt: 1
					}
				}).fetch()
			};
		}
		return records;
	}
});

RocketChat.models.Settings.on('change', ({clientAction, id, data}) => {
	switch (clientAction) {
		case 'updated':
		case 'inserted':
			const setting = data || RocketChat.models.Settings.findOneById(id);
			const value = {
				_id: setting._id,
				value: setting.value,
				editor: setting.editor,
				properties: setting.properties
			};

			if (setting['public'] === true) {
				RocketChat.Notifications.notifyAllInThisInstance('public-settings-changed', clientAction, value);
			} else {
				RocketChat.Notifications.notifyLoggedInThisInstance('private-settings-changed', clientAction, value);
			}
			break;

		case 'removed':
			RocketChat.Notifications.notifyLoggedInThisInstance('private-settings-changed', clientAction, { _id: id });
			RocketChat.Notifications.notifyAllInThisInstance('public-settings-changed', clientAction, { _id: id });
			break;
	}
});

RocketChat.Notifications.streamAll.allowRead('private-settings-changed', function() {
	if (this.userId == null) {
		return false;
	}
	return RocketChat.authz.hasPermission(this.userId, 'view-privileged-setting');
});
