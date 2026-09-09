import io
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy.orm import Session

from ..crypto import decrypt, encrypt
from ..database import get_db
from ..models import Application
from ..schemas import ApplicationCreate, ApplicationOut
from ..security import get_current_admin

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.post("", status_code=201)
def create_application(data: ApplicationCreate, db: Session = Depends(get_db)):
    app_row = Application(
        name_encrypted=encrypt(data.name),
        phone_encrypted=encrypt(data.phone),
    )
    db.add(app_row)
    db.commit()
    return {"status": "ok"}


def _date_range_filter(query, date_from: date | None, date_to: date | None):
    if date_from:
        query = query.filter(Application.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(Application.created_at <= datetime.combine(date_to, time.max))
    return query


@router.get("", response_model=list[ApplicationOut])
def list_applications(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    admin: str = Depends(get_current_admin),
):
    query = _date_range_filter(db.query(Application), date_from, date_to)
    rows = query.order_by(Application.created_at.desc()).all()
    return [
        ApplicationOut(
            id=r.id,
            name=decrypt(r.name_encrypted),
            phone=decrypt(r.phone_encrypted),
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.delete("")
def delete_applications(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    admin: str = Depends(get_current_admin),
):
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="Некорректный диапазон дат")
    query = _date_range_filter(db.query(Application), date_from, date_to)
    deleted = query.delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}


@router.get("/export")
def export_applications(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    admin: str = Depends(get_current_admin),
):
    query = _date_range_filter(db.query(Application), date_from, date_to)
    rows = query.order_by(Application.created_at.desc()).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Заявки"
    ws.append(["Имя", "Телефон", "Дата"])
    for r in rows:
        ws.append([decrypt(r.name_encrypted), decrypt(r.phone_encrypted), r.created_at.strftime("%d.%m.%Y %H:%M")])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"applications_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
