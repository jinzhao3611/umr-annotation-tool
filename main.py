from umr_annot_tool import create_app,db
from flask_migrate import Migrate,MigrateCommand
from flask_script import Manager
import jpype
app = create_app()
migrate=Migrate(app,db)
manager=Manager(app)
manager.add_command('db',MigrateCommand)
if __name__ == '__main__':
    print('hello')

    manager.run()
